package app.textsy.data

import app.textsy.data.local.StoredSession
import app.textsy.data.model.SelfUser
import app.textsy.data.remote.ApiException
import app.textsy.data.remote.Network
import app.textsy.data.remote.SessionHolder
import app.textsy.data.repo.AuthRepository
import app.textsy.data.repo.SessionState
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class AuthRepositoryTest {
    private lateinit var server: MockWebServer
    private lateinit var repo: AuthRepository
    private val store = FakeSessionStore()
    private val holder = SessionHolder()
    private val json = Network.json()

    private fun user(handle: String = "asha") =
        """{"id":"u1","handle":"$handle","email":"a@x.com","city":"Meerut","interests":["cricket"]}"""

    private val savedUser = SelfUser(id = "u1", handle = "asha", email = "a@x.com", city = "Meerut")

    @Before
    fun setUp() {
        server = MockWebServer().apply { start() }
        val api = Network.api(server.url("/").toString(), Network.okHttp(holder, debug = false), json)
        repo = AuthRepository(api, store, json, holder)
    }

    @After
    fun tearDown() = server.shutdown()

    @Test
    fun `starting with no saved session means signed out`() = runBlocking {
        repo.restore()
        assertEquals(SessionState.SignedOut, repo.state.value)
        assertEquals(0, server.requestCount)
    }

    @Test
    fun `a saved session is validated with the server and refreshed`() = runBlocking {
        store.saved = StoredSession("jwt-old", savedUser)
        server.enqueue(MockResponse().setBody("""{"user":${user("asha_new")}}"""))

        repo.restore()

        val state = repo.state.value as SessionState.SignedIn
        assertEquals("asha_new", state.user.handle)
        assertEquals("asha_new", store.saved!!.user.handle)
        assertEquals("jwt-old", repo.token)
        assertEquals("Bearer jwt-old", server.takeRequest().getHeader("Authorization"))
    }

    @Test
    fun `opening the app offline keeps the person signed in`() = runBlocking {
        store.saved = StoredSession("jwt-old", savedUser)
        server.shutdown()

        repo.restore()

        assertEquals(SessionState.SignedIn(savedUser), repo.state.value)
        assertEquals("jwt-old", repo.token)
    }

    @Test
    fun `a session the server rejects is cleared`() = runBlocking {
        store.saved = StoredSession("jwt-dead", savedUser)
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"Session expired. Please sign in again."}"""))

        repo.restore()

        assertEquals(SessionState.SignedOut, repo.state.value)
        assertNull(store.saved)
        assertNull(repo.token)
    }

    @Test
    fun `a banned account is signed out on launch`() = runBlocking {
        store.saved = StoredSession("jwt", savedUser)
        server.enqueue(MockResponse().setResponseCode(403).setBody("""{"error":"Account suspended","code":"banned"}"""))

        repo.restore()

        assertEquals(SessionState.SignedOut, repo.state.value)
    }

    @Test
    fun `logging in stores the session and signs in`() = runBlocking {
        server.enqueue(MockResponse().setBody("""{"token":"jwt-new","user":${user()}}"""))

        val result = repo.login("  asha ", "password1")

        assertEquals("asha", result.handle)
        assertEquals("jwt-new", repo.token)
        assertEquals("jwt-new", store.saved!!.token)
        assertTrue(repo.state.value is SessionState.SignedIn)
        assertTrue(server.takeRequest().body.readUtf8().contains("\"identifier\":\"asha\""))
    }

    @Test
    fun `wrong login details leave the person signed out and report why`() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"Incorrect email/handle or password"}"""))

        val error = try {
            repo.login("asha", "wrongpass")
            null
        } catch (e: ApiException) {
            e
        }

        assertEquals(401, error!!.status)
        assertNull(repo.token)
        assertNull(store.saved)
    }

    @Test
    fun `updating the profile refreshes the stored copy`() = runBlocking {
        store.saved = StoredSession("jwt", savedUser)
        holder.token = "jwt"
        server.enqueue(MockResponse().setBody("""{"user":${user("asha")}}"""))

        val updated = repo.updateProfile(app.textsy.data.model.UpdateProfileRequest(bio = "hello"))

        assertEquals("asha", updated.handle)
        assertEquals("asha", store.saved!!.user.handle)
        assertTrue(repo.state.value is SessionState.SignedIn)
    }

    @Test
    fun `signing out forgets the session`() = runBlocking {
        server.enqueue(MockResponse().setBody("""{"token":"jwt-new","user":${user()}}"""))
        repo.login("asha", "password1")

        repo.signOut()

        assertEquals(SessionState.SignedOut, repo.state.value)
        assertNull(repo.token)
        assertNull(store.saved)
    }

    @Test
    fun `deleting the account signs out only after the server agrees`() = runBlocking {
        server.enqueue(MockResponse().setBody("""{"token":"jwt-new","user":${user()}}"""))
        repo.login("asha", "password1")

        server.enqueue(MockResponse().setResponseCode(403).setBody("""{"error":"Incorrect password","code":"wrong_password"}"""))
        val error = try {
            repo.deleteAccount("nope")
            null
        } catch (e: ApiException) {
            e
        }
        assertEquals("wrong_password", error!!.code)
        assertTrue("still signed in after a typo", repo.state.value is SessionState.SignedIn)

        server.enqueue(MockResponse().setBody("""{"success":true}"""))
        repo.deleteAccount("password1")
        assertEquals(SessionState.SignedOut, repo.state.value)
        assertNull(store.saved)
    }
}
