package app.textsy.data

import app.textsy.data.model.MessageStatus
import app.textsy.data.model.RegisterRequest
import app.textsy.data.model.SelfUser
import app.textsy.data.remote.ApiException
import app.textsy.data.remote.Network
import app.textsy.data.remote.SessionHolder
import app.textsy.data.remote.SocketEvent
import app.textsy.data.remote.SocketIoChatSocket
import app.textsy.data.repo.AuthRepository
import app.textsy.data.repo.ChatRepository
import app.textsy.data.repo.PeopleRepository
import app.textsy.data.repo.SessionState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test

/**
 * Drives the real client code against a real running backend. Skipped unless TEXTSY_API_URL is set:
 *
 *   cd backend && PORT=3999 npm run dev:memory
 *   cd android && TEXTSY_API_URL=http://127.0.0.1:3999 ./gradlew testDebugUnitTest --tests '*BackendIntegrationTest*'
 */
class BackendIntegrationTest {
    private val baseUrl: String? = System.getenv("TEXTSY_API_URL")?.takeIf { it.isNotBlank() }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val suffix = System.nanoTime().toString(36).takeLast(8)
    private val clients = mutableListOf<Client>()

    @Before
    fun setUp() = assumeTrue("TEXTSY_API_URL not set, skipping integration tests", baseUrl != null)

    @After
    fun tearDown() {
        clients.forEach { it.chats.stop() }
        scope.cancel()
    }

    /** One person's app: their own session, network stack and repositories. */
    private inner class Client(val handle: String) {
        val json = Network.json()
        val holder = SessionHolder()
        val api = Network.api(baseUrl!!, Network.okHttp(holder, debug = false), json)
        val store = FakeSessionStore()
        val auth = AuthRepository(api, store, json, holder)
        val socket = SocketIoChatSocket(baseUrl!!, json)
        val chats = ChatRepository(api, socket, json, scope)
        val people = PeopleRepository(api, json)
        lateinit var me: SelfUser

        init {
            clients += this
        }

        suspend fun register(interests: List<String> = emptyList()): Client {
            me = auth.register(
                RegisterRequest(
                    email = "$handle@example.com", handle = handle, password = PASSWORD, ageConfirmed = true,
                    displayName = "Test $handle", interests = interests,
                )
            )
            return this
        }

        suspend fun goOnline(): Client {
            chats.start(auth.token!!, me.id)
            withTimeout(WAIT_MS) { socket.connected.first { it } }
            return this
        }
    }

    private fun newClient(label: String) = Client("$label$suffix")

    private suspend fun eventually(what: String, timeoutMs: Long = WAIT_MS, check: () -> Boolean) {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (check()) return
            delay(40)
        }
        fail("Timed out waiting for: $what")
    }

    private fun Client.thread(chatId: String) = chats.threads.value[chatId]

    @Test
    fun `register, then restore the session from storage like an app restart`() = runBlocking {
        val asha = newClient("asha").register(listOf("cricket"))
        assertTrue(asha.auth.state.value is SessionState.SignedIn)
        assertEquals("Meerut", asha.me.city)
        assertTrue(asha.store.saved!!.token.isNotBlank())

        // A new process: fresh network stack, same saved session.
        val holder = SessionHolder()
        val restarted = AuthRepository(Network.api(baseUrl!!, Network.okHttp(holder, false), Network.json()), asha.store, Network.json(), holder)
        restarted.restore()

        val state = restarted.state.value as SessionState.SignedIn
        assertEquals(asha.handle, state.user.handle)
    }

    @Test
    fun `server validation and conflicts come back as typed errors`() = runBlocking {
        val first = newClient("dup").register()

        val taken = try {
            newClient("dup").also { it.auth.register(RegisterRequest("other-$suffix@example.com", first.handle, PASSWORD, true)) }
            null
        } catch (e: ApiException) {
            e
        }
        assertEquals("handle_taken", taken?.code)
        assertEquals(409, taken?.status)

        val weak = try {
            newClient("weak").auth.register(RegisterRequest("weak-$suffix@example.com", "weak$suffix", "short", true))
            null
        } catch (e: ApiException) {
            e
        }
        assertEquals(400, weak?.status)

        val wrongLogin = try {
            newClient("nobody").auth.login("no-such-user-$suffix", "whatever123")
            null
        } catch (e: ApiException) {
            e
        }
        assertEquals(401, wrongLogin?.status)
    }

    @Test
    fun `two people find each other, chat live, and see read receipts and typing`() = runBlocking {
        val tag = "tag$suffix"
        val asha = newClient("asha").register(listOf(tag, "chess"))
        val ravi = newClient("ravi").register(listOf(tag))

        // Discovery: Ravi finds Asha through the shared interest.
        val found = ravi.people.discover(tag = tag).users
        assertEquals(listOf(asha.handle), found.map { it.handle })
        assertEquals(listOf(tag), found.single().sharedInterests)

        ravi.goOnline()
        asha.goOnline()
        val chatId = ravi.chats.openChat(asha.handle)
        asha.chats.refreshChats()
        assertEquals(listOf(chatId), asha.chats.chats.value.map { it.id })
        asha.chats.setActiveChat(chatId)

        // Ravi -> Asha, delivered live, shown once, confirmed for the sender.
        ravi.chats.send(chatId, "Namaste Asha")
        eventually("Asha sees Ravi's message") { asha.thread(chatId)?.messages?.any { it.text == "Namaste Asha" } == true }
        eventually("Ravi's copy is confirmed") { ravi.thread(chatId)?.messages?.singleOrNull()?.status == MessageStatus.SENT }
        assertEquals(1, asha.thread(chatId)!!.messages.size)
        assertEquals(ravi.me.id, asha.thread(chatId)!!.messages.single().sender)

        // Asha has the chat open, so it was marked read and Ravi sees the receipt.
        eventually("Ravi sees the read receipt") { ravi.thread(chatId)?.otherReadAt != null }
        assertEquals(0, asha.chats.chats.value.single().unread)

        // Typing indicator travels to the other person.
        asha.chats.setTyping(chatId, true)
        eventually("Ravi sees Asha typing") { ravi.thread(chatId)?.otherTyping == true }

        // Asha replies while Ravi is looking at the chat list, not the chat: his unread badge grows.
        asha.chats.send(chatId, "Hi Ravi!")
        eventually("Ravi's unread badge shows 1") { ravi.chats.chats.value.single().unread == 1 }
        assertEquals("Hi Ravi!", ravi.chats.chats.value.single().lastMessage?.text)
        eventually("typing indicator cleared by the message") { ravi.thread(chatId)?.otherTyping == false }

        // Opening the chat and loading history shows both messages in order, once each.
        ravi.chats.setActiveChat(chatId)
        ravi.chats.loadThread(chatId)
        assertEquals(listOf("Namaste Asha", "Hi Ravi!"), ravi.thread(chatId)!!.messages.map { it.text })
        eventually("Ravi's unread cleared") { ravi.chats.chats.value.single().unread == 0 }
    }

    @Test
    fun `a message sent while offline is delivered exactly once after reconnecting`() = runBlocking {
        val asha = newClient("asha").register()
        val ravi = newClient("ravi").register()
        ravi.goOnline()
        asha.goOnline()
        val chatId = ravi.chats.openChat(asha.handle)
        asha.chats.refreshChats()

        ravi.socket.disconnect()
        eventually("Ravi is offline") { !ravi.socket.connected.value }

        ravi.chats.send(chatId, "sent while offline")
        eventually("the message is marked failed") { ravi.thread(chatId)?.messages?.singleOrNull()?.status == MessageStatus.FAILED }

        ravi.socket.connect(ravi.auth.token!!)

        eventually("the queued message is delivered") { ravi.thread(chatId)?.messages?.singleOrNull()?.status == MessageStatus.SENT }
        eventually("Asha receives it") { asha.thread(chatId)?.messages?.any { it.text == "sent while offline" } == true }
        delay(500)
        assertEquals(1, asha.thread(chatId)!!.messages.count { it.text == "sent while offline" })

        asha.chats.loadThread(chatId)
        assertEquals("the server stored it once", 1, asha.thread(chatId)!!.messages.count { it.text == "sent while offline" })
    }

    @Test
    fun `long history loads in pages without gaps or repeats`() = runBlocking {
        val asha = newClient("asha").register()
        val ravi = newClient("ravi").register()
        ravi.goOnline()
        asha.goOnline()
        val chatId = ravi.chats.openChat(asha.handle)
        asha.chats.refreshChats()

        // 36 messages, alternating senders so neither exceeds the server's per-user send limit.
        for (i in 1..36) {
            val sender = if (i % 2 == 1) ravi else asha
            sender.chats.send(chatId, "message %02d".format(i))
            eventually("message $i confirmed") {
                sender.thread(chatId)?.messages?.any { it.text == "message %02d".format(i) && it.status == MessageStatus.SENT } == true
            }
        }

        // A fresh app instance for Ravi loads history from the server only.
        val fresh = newClient("ravi2")
        fresh.auth.login(ravi.handle, PASSWORD)
        fresh.me = fresh.auth.state.value.let { (it as SessionState.SignedIn).user }
        fresh.chats.start(fresh.auth.token!!, fresh.me.id)

        fresh.chats.loadThread(chatId)
        assertEquals(30, fresh.thread(chatId)!!.messages.size)
        assertTrue(fresh.thread(chatId)!!.hasMore)
        assertEquals("message 07", fresh.thread(chatId)!!.messages.first().text)

        fresh.chats.loadOlder(chatId)
        val all = fresh.thread(chatId)!!
        assertEquals((1..36).map { "message %02d".format(it) }, all.messages.map { it.text })
        assertEquals(false, all.hasMore)
    }

    @Test
    fun `a dead token is reported as an auth rejection instead of reconnecting forever`() = runBlocking {
        val socket = SocketIoChatSocket(baseUrl!!, Network.json())
        val rejected = scope.async {
            withTimeout(WAIT_MS) { socket.events.first { it is SocketEvent.AuthRejected } }
        }
        delay(100)
        socket.connect("this-is-not-a-valid-token")

        val event = rejected.await() as SocketEvent.AuthRejected
        assertEquals(false, event.banned)
        assertEquals(false, socket.connected.value)
        socket.disconnect()
    }

    @Test
    fun `blocking hides the chat and stops new ones`() = runBlocking {
        val asha = newClient("asha").register()
        val ravi = newClient("ravi").register()
        val chatId = ravi.chats.openChat(asha.handle)

        asha.people.block(ravi.handle)

        asha.chats.refreshChats()
        assertTrue("blocked person's chat is hidden", asha.chats.chats.value.none { it.id == chatId })
        ravi.chats.refreshChats()
        assertTrue("and hidden from the blocked person too", ravi.chats.chats.value.none { it.id == chatId })
        val error = try {
            ravi.chats.openChat(asha.handle)
            null
        } catch (e: ApiException) {
            e
        }
        assertEquals(404, error?.status)
        assertEquals(listOf(ravi.handle), asha.people.blocked().map { it.handle })

        asha.people.unblock(ravi.handle)
        asha.chats.refreshChats()
        assertNotNull(asha.chats.chats.value.firstOrNull { it.id == chatId })
    }

    @Test
    fun `deleting the account needs the right password and then really removes it`() = runBlocking {
        val asha = newClient("asha").register()

        val wrong = try {
            asha.auth.deleteAccount("not-my-password")
            null
        } catch (e: ApiException) {
            e
        }
        assertEquals(403, wrong?.status)
        assertEquals("wrong_password", wrong?.code)
        assertTrue("a typo must not sign the person out", asha.auth.state.value is SessionState.SignedIn)

        asha.auth.deleteAccount(PASSWORD)
        assertEquals(SessionState.SignedOut, asha.auth.state.value)
        assertNull(asha.store.saved)

        val login = try {
            newClient("again").auth.login(asha.handle, PASSWORD)
            null
        } catch (e: ApiException) {
            e
        }
        assertEquals(401, login?.status)
    }

    private companion object {
        const val PASSWORD = "password123"
        const val WAIT_MS = 8_000L
    }
}
