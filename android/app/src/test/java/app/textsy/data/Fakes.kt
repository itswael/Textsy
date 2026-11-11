package app.textsy.data

import app.textsy.data.local.SessionStore
import app.textsy.data.local.StoredSession
import app.textsy.data.model.AuthResponse
import app.textsy.data.model.ChatResponse
import app.textsy.data.model.ChatsResponse
import app.textsy.data.model.LoginRequest
import app.textsy.data.model.MessagesResponse
import app.textsy.data.model.OkResponse
import app.textsy.data.model.OpenChatRequest
import app.textsy.data.model.PasswordRequest
import app.textsy.data.model.PublicUserResponse
import app.textsy.data.model.RegisterRequest
import app.textsy.data.model.SelfUserResponse
import app.textsy.data.model.UpdateProfileRequest
import app.textsy.data.model.UsersResponse
import app.textsy.data.remote.ChatSocket
import app.textsy.data.remote.SendResult
import app.textsy.data.remote.SocketEvent
import app.textsy.data.remote.TextsyApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow

class FakeSessionStore(var saved: StoredSession? = null) : SessionStore {
    override suspend fun load() = saved
    override suspend fun save(session: StoredSession) {
        saved = session
    }

    override suspend fun clear() {
        saved = null
    }
}

/** A socket the test controls: it decides what sending returns and when connection events happen. */
class FakeChatSocket : ChatSocket {
    override val connected = MutableStateFlow(false)
    private val _events = MutableSharedFlow<SocketEvent>(extraBufferCapacity = 64)
    override val events: SharedFlow<SocketEvent> = _events.asSharedFlow()

    var connectedWithToken: String? = null
    var disconnectCount = 0

    /** Every attempt to send: (chatId, text, clientId). */
    val sendAttempts = mutableListOf<Triple<String, String, String>>()
    var sendHandler: suspend (chatId: String, text: String, clientId: String) -> SendResult = { _, _, _ -> SendResult.Unavailable }

    val readMarks = mutableListOf<String>()
    var markReadWorks = true
    val typingSent = mutableListOf<Pair<String, Boolean>>()

    override fun connect(token: String) {
        connectedWithToken = token
    }

    override fun disconnect() {
        disconnectCount++
        connected.value = false
    }

    override suspend fun send(chatId: String, text: String, clientId: String): SendResult {
        sendAttempts += Triple(chatId, text, clientId)
        return sendHandler(chatId, text, clientId)
    }

    override fun markRead(chatId: String): Boolean {
        if (!markReadWorks) return false
        readMarks += chatId
        return true
    }

    override fun typing(chatId: String, isTyping: Boolean) {
        typingSent += chatId to isTyping
    }

    fun emit(event: SocketEvent) {
        check(_events.tryEmit(event))
    }
}

/** An API where only the calls a test cares about are implemented. */
open class FakeApi : TextsyApi {
    var chatsResult: () -> ChatsResponse = { ChatsResponse() }
    var messagesResult: (chatId: String, before: String?) -> MessagesResponse = { _, _ -> MessagesResponse() }
    var openChatResult: (handle: String) -> ChatResponse = { error("openChat not stubbed") }

    var chatsCalls = 0
    val markReadCalls = mutableListOf<String>()

    override suspend fun chats(): ChatsResponse {
        chatsCalls++
        return chatsResult()
    }

    override suspend fun messages(chatId: String, before: String?, limit: Int) = messagesResult(chatId, before)
    override suspend fun markRead(chatId: String): OkResponse {
        markReadCalls += chatId
        return OkResponse()
    }

    override suspend fun openChat(body: OpenChatRequest) = openChatResult(body.handle)

    override suspend fun register(body: RegisterRequest): AuthResponse = notStubbed()
    override suspend fun login(body: LoginRequest): AuthResponse = notStubbed()
    override suspend fun me(): SelfUserResponse = notStubbed()
    override suspend fun deleteAccount(body: PasswordRequest): OkResponse = notStubbed()
    override suspend fun updateMe(body: UpdateProfileRequest): SelfUserResponse = notStubbed()
    override suspend fun discover(tag: String?, area: String?, limit: Int, skip: Int): UsersResponse = notStubbed()
    override suspend fun search(query: String): UsersResponse = notStubbed()
    override suspend fun blocked(): UsersResponse = notStubbed()
    override suspend fun profile(handle: String): PublicUserResponse = notStubbed()
    override suspend fun block(handle: String): OkResponse = notStubbed()
    override suspend fun unblock(handle: String): OkResponse = notStubbed()

    private fun notStubbed(): Nothing = error("not stubbed in this test")
}
