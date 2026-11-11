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
import app.textsy.data.model.Preferences
import app.textsy.data.model.PublicUserResponse
import app.textsy.data.model.RegisterRequest
import app.textsy.data.model.SelfUser
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
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody

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

/** Builds the exception Retrofit throws for a non-2xx response, so fakes can fail like the real server. */
fun httpError(status: Int, error: String, code: String? = null): retrofit2.HttpException {
    val body = """{"error":"$error"${if (code != null) ""","code":"$code"""" else ""}}"""
    return retrofit2.HttpException(
        retrofit2.Response.error<Any>(status, body.toResponseBody("application/json".toMediaType()))
    )
}

fun sampleUser(
    id: String = "me",
    handle: String = "asha",
    name: String = "Asha",
    interests: List<String> = listOf("cricket", "chess"),
    preferences: Preferences = Preferences(),
) = SelfUser(
    id = id, handle = handle, email = "$handle@example.com", displayName = name,
    interests = interests, city = "Meerut", area = "Shastri Nagar", preferences = preferences,
)

/** An API where every call is a stub the test can replace; unstubbed calls fail loudly. Calls are recorded. */
open class FakeApi : TextsyApi {
    var loginResult: (LoginRequest) -> AuthResponse = { error("login not stubbed") }
    var registerResult: (RegisterRequest) -> AuthResponse = { error("register not stubbed") }
    var meResult: () -> SelfUserResponse = { error("me not stubbed") }
    var updateMeResult: (UpdateProfileRequest) -> SelfUserResponse = { error("updateMe not stubbed") }
    var deleteResult: (PasswordRequest) -> OkResponse = { error("deleteAccount not stubbed") }
    var discoverResult: (tag: String?, skip: Int) -> UsersResponse = { _, _ -> UsersResponse() }
    var searchResult: (String) -> UsersResponse = { UsersResponse() }
    var blockedResult: () -> UsersResponse = { UsersResponse() }
    var chatsResult: () -> ChatsResponse = { ChatsResponse() }
    var messagesResult: (chatId: String, before: String?) -> MessagesResponse = { _, _ -> MessagesResponse() }
    var openChatResult: (handle: String) -> ChatResponse = { error("openChat not stubbed") }

    val loginCalls = mutableListOf<LoginRequest>()
    val registerCalls = mutableListOf<RegisterRequest>()
    val updateCalls = mutableListOf<UpdateProfileRequest>()
    val deleteCalls = mutableListOf<PasswordRequest>()
    val discoverCalls = mutableListOf<Pair<String?, Int>>()
    val searchCalls = mutableListOf<String>()
    val blockCalls = mutableListOf<String>()
    val unblockCalls = mutableListOf<String>()
    val openChatCalls = mutableListOf<String>()
    val markReadCalls = mutableListOf<String>()
    var chatsCalls = 0

    override suspend fun login(body: LoginRequest): AuthResponse {
        loginCalls += body
        return loginResult(body)
    }

    override suspend fun register(body: RegisterRequest): AuthResponse {
        registerCalls += body
        return registerResult(body)
    }

    override suspend fun me(): SelfUserResponse = meResult()

    override suspend fun updateMe(body: UpdateProfileRequest): SelfUserResponse {
        updateCalls += body
        return updateMeResult(body)
    }

    override suspend fun deleteAccount(body: PasswordRequest): OkResponse {
        deleteCalls += body
        return deleteResult(body)
    }

    override suspend fun discover(tag: String?, area: String?, limit: Int, skip: Int): UsersResponse {
        discoverCalls += tag to skip
        return discoverResult(tag, skip)
    }

    override suspend fun search(query: String): UsersResponse {
        searchCalls += query
        return searchResult(query)
    }

    override suspend fun blocked(): UsersResponse = blockedResult()

    override suspend fun block(handle: String): OkResponse {
        blockCalls += handle
        return OkResponse()
    }

    override suspend fun unblock(handle: String): OkResponse {
        unblockCalls += handle
        return OkResponse()
    }

    override suspend fun chats(): ChatsResponse {
        chatsCalls++
        return chatsResult()
    }

    override suspend fun messages(chatId: String, before: String?, limit: Int) = messagesResult(chatId, before)

    override suspend fun markRead(chatId: String): OkResponse {
        markReadCalls += chatId
        return OkResponse()
    }

    override suspend fun openChat(body: OpenChatRequest): ChatResponse {
        openChatCalls += body.handle
        return openChatResult(body.handle)
    }

    override suspend fun profile(handle: String): PublicUserResponse = error("profile not stubbed")
}
