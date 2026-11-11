package app.textsy.data.remote

import app.textsy.data.model.ChatReadEvent
import app.textsy.data.model.ChatUpdatedEvent
import app.textsy.data.model.MessageNewEvent
import app.textsy.data.model.PresenceEvent
import app.textsy.data.model.ServerMessage
import app.textsy.data.model.TypingEvent
import io.socket.client.Ack
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.Json
import org.json.JSONObject
import java.net.URI
import kotlin.coroutines.resume

/** Everything the server can push to the app over the socket. */
sealed interface SocketEvent {
    data class NewMessage(val message: ServerMessage) : SocketEvent
    data class ChatUpdated(val update: ChatUpdatedEvent) : SocketEvent
    data class ChatRead(val event: ChatReadEvent) : SocketEvent
    data class Typing(val event: TypingEvent) : SocketEvent
    data class Presence(val event: PresenceEvent) : SocketEvent

    /** The server refused the session (invalid, expired or banned). Reconnecting will not help. */
    data class AuthRejected(val banned: Boolean) : SocketEvent
}

/** Outcome of sending one message. */
sealed interface SendResult {
    data class Delivered(val message: ServerMessage, val duplicate: Boolean) : SendResult

    /** The server understood the message and said no. Retrying the same text will not help. */
    data class Rejected(val code: String, val reason: String) : SendResult

    /** No answer: offline, disconnected or timed out. Safe to retry with the same client id. */
    data object Unavailable : SendResult
}

/** The live connection to the backend. An interface so the rest of the app can be tested without a network. */
interface ChatSocket {
    val connected: StateFlow<Boolean>
    val events: SharedFlow<SocketEvent>

    fun connect(token: String)
    fun disconnect()
    suspend fun send(chatId: String, text: String, clientId: String): SendResult

    /** Returns false when the socket is not connected, so the caller can use REST instead. */
    fun markRead(chatId: String): Boolean
    fun typing(chatId: String, isTyping: Boolean)
}

/** [ChatSocket] over the official Socket.IO Java client. */
class SocketIoChatSocket(
    baseUrl: String,
    private val json: Json,
    private val sendTimeoutMs: Long = 10_000,
) : ChatSocket {
    private val uri: URI = URI.create(baseUrl.trimEnd('/'))

    @Volatile
    private var socket: Socket? = null

    private val _connected = MutableStateFlow(false)
    override val connected: StateFlow<Boolean> = _connected.asStateFlow()

    private val _events = MutableSharedFlow<SocketEvent>(extraBufferCapacity = 256)
    override val events: SharedFlow<SocketEvent> = _events.asSharedFlow()

    override fun connect(token: String) {
        disconnect()
        val options = IO.Options().apply {
            auth = mapOf("token" to token)
            transports = arrayOf("websocket")
            reconnection = true
            reconnectionDelay = 1_000
            reconnectionDelayMax = 10_000
            timeout = 15_000
        }
        val next = IO.socket(uri, options)
        socket = next

        next.on(Socket.EVENT_CONNECT) { _connected.value = true }
        next.on(Socket.EVENT_DISCONNECT) { _connected.value = false }
        next.on(Socket.EVENT_CONNECT_ERROR) { args -> onConnectError(next, args.firstOrNull()) }

        listen<MessageNewEvent>(next, "message:new") { SocketEvent.NewMessage(it.message) }
        listen<ChatUpdatedEvent>(next, "chat:updated") { SocketEvent.ChatUpdated(it) }
        listen<ChatReadEvent>(next, "chat:read") { SocketEvent.ChatRead(it) }
        listen<TypingEvent>(next, "typing") { SocketEvent.Typing(it) }
        listen<PresenceEvent>(next, "presence") { SocketEvent.Presence(it) }

        next.connect()
    }

    override fun disconnect() {
        val current = socket ?: return
        socket = null
        current.off()
        current.disconnect()
        current.close()
        _connected.value = false
    }

    override suspend fun send(chatId: String, text: String, clientId: String): SendResult {
        val current = socket
        if (current == null || !current.connected()) return SendResult.Unavailable

        val payload = JSONObject().put("chatId", chatId).put("text", text).put("clientId", clientId)
        return withTimeoutOrNull(sendTimeoutMs) {
            suspendCancellableCoroutine { continuation ->
                current.emit("message:send", payload, Ack { args ->
                    if (continuation.isActive) continuation.resume(parseSendResult(args.firstOrNull() as? JSONObject))
                })
            }
        } ?: SendResult.Unavailable
    }

    override fun markRead(chatId: String): Boolean {
        val current = socket
        if (current == null || !current.connected()) return false
        current.emit("chat:read", JSONObject().put("chatId", chatId))
        return true
    }

    override fun typing(chatId: String, isTyping: Boolean) {
        val current = socket ?: return
        if (!current.connected()) return
        current.emit("typing", JSONObject().put("chatId", chatId).put("isTyping", isTyping))
    }

    private inline fun <reified T> listen(target: Socket, name: String, crossinline toEvent: (T) -> SocketEvent) {
        target.on(name) { args ->
            val raw = (args.firstOrNull() as? JSONObject)?.toString() ?: return@on
            runCatching { json.decodeFromString<T>(raw) }.getOrNull()?.let { _events.tryEmit(toEvent(it)) }
        }
    }

    private fun parseSendResult(reply: JSONObject?): SendResult {
        if (reply == null) return SendResult.Unavailable
        if (reply.optBoolean("ok")) {
            val message = reply.optJSONObject("message") ?: return SendResult.Unavailable
            val parsed = runCatching { json.decodeFromString<ServerMessage>(message.toString()) }.getOrNull()
                ?: return SendResult.Unavailable
            return SendResult.Delivered(parsed, reply.optBoolean("duplicate"))
        }
        val code = reply.optString("code", "error")
        // Rate limiting is temporary, so treat it like "try again" rather than a permanent no.
        if (code == "rate_limited") return SendResult.Unavailable
        return SendResult.Rejected(code, reply.optString("error", "Message rejected"))
    }

    /** The server's handshake middleware reports auth failures as `{ message, data: { code } }`. */
    private fun onConnectError(source: Socket, error: Any?) {
        val code = (error as? JSONObject)?.optJSONObject("data")?.optString("code")
        if (code == "auth" || code == "banned") {
            if (socket === source) disconnect()
            _events.tryEmit(SocketEvent.AuthRejected(banned = code == "banned"))
        }
    }
}
