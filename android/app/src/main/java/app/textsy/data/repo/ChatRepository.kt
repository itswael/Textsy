package app.textsy.data.repo

import app.textsy.data.model.ChatMessage
import app.textsy.data.model.ChatSummary
import app.textsy.data.model.MessageStatus
import app.textsy.data.model.OpenChatRequest
import app.textsy.data.model.ServerMessage
import app.textsy.data.remote.ApiException
import app.textsy.data.remote.ChatSocket
import app.textsy.data.remote.SendResult
import app.textsy.data.remote.SocketEvent
import app.textsy.data.remote.TextsyApi
import app.textsy.data.remote.apiCall
import app.textsy.domain.ChatLogic
import app.textsy.domain.Validators
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import java.time.Instant

sealed interface LoadState {
    data object Idle : LoadState
    data object Loading : LoadState
    data class Failed(val error: ApiException) : LoadState
}

/** Everything the UI needs to draw one conversation. */
data class ChatThread(
    val messages: List<ChatMessage> = emptyList(),
    /** The first page has been fetched at least once. */
    val loaded: Boolean = false,
    val loading: Boolean = false,
    val loadingOlder: Boolean = false,
    val hasMore: Boolean = false,
    val nextBefore: String? = null,
    /** When the other person last read the chat, used to show "seen". */
    val otherReadAt: String? = null,
    val otherTyping: Boolean = false,
    val error: ApiException? = null,
)

/**
 * The single source of truth for chats and messages. It keeps the chat list and every open
 * conversation up to date from both the REST API (history) and the live socket (new activity).
 *
 * Sending is optimistic: the message appears at once as SENDING, becomes SENT when the server
 * confirms it, and is retried automatically if the connection was down. The server recognises a
 * retried message by its client id, so a flaky network never produces duplicates.
 */
class ChatRepository(
    private val api: TextsyApi,
    private val socket: ChatSocket,
    private val json: Json,
    private val scope: CoroutineScope,
    private val now: () -> String = { Instant.now().toString() },
    private val newClientId: () -> String = ChatLogic::newClientId,
    private val typingTimeoutMs: Long = 5_000,
) {
    private val _chats = MutableStateFlow<List<ChatSummary>>(emptyList())
    val chats: StateFlow<List<ChatSummary>> = _chats.asStateFlow()

    private val _chatsState = MutableStateFlow<LoadState>(LoadState.Idle)
    val chatsState: StateFlow<LoadState> = _chatsState.asStateFlow()

    private val _threads = MutableStateFlow<Map<String, ChatThread>>(emptyMap())
    val threads: StateFlow<Map<String, ChatThread>> = _threads.asStateFlow()

    val connected: StateFlow<Boolean> get() = socket.connected

    /** Called when the server rejects the session over the socket (expired, banned). */
    var onAuthRejected: (banned: Boolean) -> Unit = {}

    private var myId: String? = null
    private var activeChatId: String? = null
    private var eventsJob: Job? = null
    private var connectionJob: Job? = null
    private val typingJobs = HashMap<String, Job>()

    /** Messages that could not be sent because the socket was down; retried on reconnect. */
    private val outbox = LinkedHashSet<Pair<String, String>>()

    fun start(token: String, userId: String) {
        stop()
        myId = userId
        // Subscribe before connecting so no early event is missed.
        eventsJob = scope.launch(start = CoroutineStart.UNDISPATCHED) { socket.events.collect(::onEvent) }
        connectionJob = scope.launch(start = CoroutineStart.UNDISPATCHED) {
            socket.connected.collect { up -> if (up) onConnected() }
        }
        socket.connect(token)
    }

    fun stop() {
        eventsJob?.cancel()
        connectionJob?.cancel()
        typingJobs.values.forEach { it.cancel() }
        typingJobs.clear()
        socket.disconnect()
        synchronized(outbox) { outbox.clear() }
        myId = null
        activeChatId = null
        _chats.value = emptyList()
        _threads.value = emptyMap()
        _chatsState.value = LoadState.Idle
    }

    /** The conversation currently on screen. Messages arriving in it are marked read straight away. */
    fun setActiveChat(chatId: String?) {
        activeChatId = chatId
        if (chatId != null) markRead(chatId)
    }

    // ---- Chat list ----

    suspend fun refreshChats() {
        if (_chats.value.isEmpty()) _chatsState.value = LoadState.Loading
        try {
            _chats.value = ChatLogic.sortChats(apiCall(json) { api.chats() }.chats)
            _chatsState.value = LoadState.Idle
        } catch (e: ApiException) {
            _chatsState.value = LoadState.Failed(e)
        }
    }

    /** Opens (or creates) the chat with this person and returns its id. Throws [ApiException]. */
    suspend fun openChat(handle: String): String {
        val chat = apiCall(json) { api.openChat(OpenChatRequest(handle)) }.chat
        _chats.update { ChatLogic.upsertChat(it, chat) }
        return chat.id
    }

    // ---- One conversation ----

    suspend fun loadThread(chatId: String) {
        updateThread(chatId) { it.copy(loading = true, error = null) }
        try {
            val page = apiCall(json) { api.messages(chatId, before = null, limit = PAGE_SIZE) }
            updateThread(chatId) { thread ->
                thread.copy(
                    messages = ChatLogic.mergeMessages(thread.messages, page.messages.map(ChatMessage::from)),
                    // Keep the paging position if the user had already scrolled back through history.
                    hasMore = if (thread.loaded) thread.hasMore else page.hasMore,
                    nextBefore = if (thread.loaded) thread.nextBefore else page.nextBefore,
                    loaded = true,
                    loading = false,
                )
            }
        } catch (e: ApiException) {
            updateThread(chatId) { it.copy(loading = false, error = e) }
        }
    }

    suspend fun loadOlder(chatId: String) {
        val thread = _threads.value[chatId] ?: return
        val cursor = thread.nextBefore
        if (!thread.hasMore || thread.loadingOlder || cursor == null) return

        updateThread(chatId) { it.copy(loadingOlder = true) }
        try {
            val page = apiCall(json) { api.messages(chatId, before = cursor, limit = PAGE_SIZE) }
            updateThread(chatId) {
                it.copy(
                    messages = ChatLogic.mergeMessages(it.messages, page.messages.map(ChatMessage::from)),
                    hasMore = page.hasMore,
                    nextBefore = page.nextBefore,
                    loadingOlder = false,
                )
            }
        } catch (e: ApiException) {
            updateThread(chatId) { it.copy(loadingOlder = false) }
        }
    }

    /** Shows the message immediately and sends it in the background. */
    fun send(chatId: String, text: String) {
        val body = text.trim()
        val me = myId
        if (me == null || body.isEmpty() || body.length > Validators.MAX_MESSAGE) return

        val clientId = newClientId()
        val local = ChatMessage("local-$clientId", chatId, me, body, clientId, now(), MessageStatus.SENDING)
        updateThread(chatId) { it.copy(messages = ChatLogic.mergeMessages(it.messages, listOf(local))) }
        scope.launch { deliver(chatId, clientId, body) }
    }

    /** Tries again to send a message that failed. */
    fun retry(chatId: String, clientId: String) {
        val pending = _threads.value[chatId]?.messages
            ?.firstOrNull { it.clientId == clientId && it.status == MessageStatus.FAILED } ?: return
        setStatus(chatId, clientId, MessageStatus.SENDING)
        scope.launch { deliver(chatId, clientId, pending.text) }
    }

    fun markRead(chatId: String) {
        _chats.update { list -> list.map { if (it.id == chatId && it.unread != 0) it.copy(unread = 0) else it } }
        scope.launch {
            if (!socket.markRead(chatId)) {
                // Not connected: fall back to REST so the unread count still clears on the server.
                runCatching { apiCall(json) { api.markRead(chatId) } }
            }
        }
    }

    fun setTyping(chatId: String, isTyping: Boolean) = socket.typing(chatId, isTyping)

    // ---- Sending ----

    private suspend fun deliver(chatId: String, clientId: String, text: String) {
        when (val result = socket.send(chatId, text, clientId)) {
            is SendResult.Delivered -> confirm(result.message)
            is SendResult.Rejected -> setStatus(chatId, clientId, MessageStatus.FAILED)
            SendResult.Unavailable -> {
                setStatus(chatId, clientId, MessageStatus.FAILED)
                synchronized(outbox) { outbox.add(chatId to clientId) }
            }
        }
    }

    private fun confirm(server: ServerMessage) {
        updateThread(server.chatId) {
            it.copy(messages = ChatLogic.mergeMessages(it.messages, listOf(ChatMessage.from(server))))
        }
    }

    private fun setStatus(chatId: String, clientId: String, status: MessageStatus) {
        updateThread(chatId) { it.copy(messages = ChatLogic.withStatus(it.messages, clientId, status)) }
    }

    private suspend fun flushOutbox() {
        val queued = synchronized(outbox) { outbox.toList().also { outbox.clear() } }
        for ((chatId, clientId) in queued) {
            val pending = _threads.value[chatId]?.messages
                ?.firstOrNull { it.clientId == clientId && it.status != MessageStatus.SENT } ?: continue
            setStatus(chatId, clientId, MessageStatus.SENDING)
            deliver(chatId, clientId, pending.text)
        }
    }

    // ---- Live events ----

    private fun onConnected() {
        scope.launch {
            // Anything that happened while offline shows up in the list and in the open chat.
            refreshChats()
            activeChatId?.let { loadThread(it) }
            flushOutbox()
        }
    }

    private fun onEvent(event: SocketEvent) {
        when (event) {
            is SocketEvent.NewMessage -> onNewMessage(event.message)

            is SocketEvent.ChatUpdated -> {
                val updated = ChatLogic.applyChatUpdate(_chats.value, event.update)
                if (updated != null) _chats.value = updated else scope.launch { refreshChats() }
            }

            is SocketEvent.ChatRead -> {
                if (event.event.userId != myId) {
                    updateThread(event.event.chatId) { it.copy(otherReadAt = event.event.readAt) }
                }
            }

            is SocketEvent.Typing -> onTyping(event)

            is SocketEvent.Presence -> _chats.update { list ->
                list.map {
                    if (it.other.id != event.event.userId) {
                        it
                    } else {
                        it.copy(
                            other = it.other.copy(
                                isOnline = event.event.isOnline,
                                lastSeen = event.event.lastSeen ?: it.other.lastSeen,
                            )
                        )
                    }
                }
            }

            is SocketEvent.AuthRejected -> onAuthRejected(event.banned)
        }
    }

    private fun onNewMessage(server: ServerMessage) {
        val fromOther = server.sender != myId
        updateThread(server.chatId) {
            it.copy(
                messages = ChatLogic.mergeMessages(it.messages, listOf(ChatMessage.from(server))),
                otherTyping = if (fromOther) false else it.otherTyping,
            )
        }
        if (fromOther && activeChatId == server.chatId) markRead(server.chatId)
    }

    private fun onTyping(event: SocketEvent.Typing) {
        val typing = event.event
        if (typing.userId == myId) return
        typingJobs.remove(typing.chatId)?.cancel()
        updateThread(typing.chatId) { it.copy(otherTyping = typing.isTyping) }
        if (typing.isTyping) {
            // The "stopped typing" event can be lost, so never show the indicator forever.
            typingJobs[typing.chatId] = scope.launch {
                delay(typingTimeoutMs)
                updateThread(typing.chatId) { it.copy(otherTyping = false) }
            }
        }
    }

    private fun updateThread(chatId: String, change: (ChatThread) -> ChatThread) {
        _threads.update { all -> all + (chatId to change(all[chatId] ?: ChatThread())) }
    }

    companion object {
        const val PAGE_SIZE = 30
    }
}
