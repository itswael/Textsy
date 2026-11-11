package app.textsy.data

import app.textsy.data.model.PasswordRequest
import app.textsy.data.model.RegisterRequest
import app.textsy.data.remote.ApiException
import app.textsy.data.remote.Network
import app.textsy.data.remote.SessionHolder
import app.textsy.data.remote.TextsyApi
import app.textsy.data.remote.apiCall
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.Json
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

class ApiTest {
    private lateinit var server: MockWebServer
    private lateinit var api: TextsyApi
    private val json: Json = Network.json()
    private val session = SessionHolder()

    @Before
    fun setUp() {
        server = MockWebServer().apply { start() }
        api = Network.api(server.url("/").toString(), Network.okHttp(session, debug = false), json)
    }

    @After
    fun tearDown() = server.shutdown()

    private val userJson = """{"id":"u1","handle":"asha","email":"a@x.com","city":"Meerut","interests":["cricket"],
        "preferences":{"language":"en","notifications":true,"showOnlineStatus":true,"showLastSeen":true},"somethingNew":1}"""

    private fun <T> call(block: suspend () -> T): T = runBlocking { apiCall(json, block) }

    private fun failure(block: suspend () -> Unit): ApiException {
        try {
            call(block)
        } catch (e: ApiException) {
            return e
        }
        fail("expected an ApiException")
        throw IllegalStateException()
    }

    @Test
    fun `register sends the expected body and ignores fields it does not know`() {
        server.enqueue(MockResponse().setResponseCode(201).setBody("""{"success":true,"token":"jwt-1","user":$userJson}"""))

        val response = call {
            api.register(
                RegisterRequest(
                    email = "a@x.com", handle = "asha", password = "password1", ageConfirmed = true,
                    inviteCode = "BETA", interests = listOf("cricket"),
                )
            )
        }

        assertEquals("jwt-1", response.token)
        assertEquals("asha", response.user.handle)
        assertEquals(listOf("cricket"), response.user.interests)

        val request = server.takeRequest()
        assertEquals("POST", request.method)
        assertEquals("/api/auth/register", request.path)
        val body = Json.parseToJsonElement(request.body.readUtf8()).jsonObject
        assertTrue(body["ageConfirmed"]!!.jsonPrimitive.boolean)
        assertEquals("BETA", body["inviteCode"]!!.jsonPrimitive.content)
        assertFalse("unset optional fields must be omitted, not sent as null", body.containsKey("displayName"))
    }

    @Test
    fun `the bearer token is sent only when signed in`() {
        server.enqueue(MockResponse().setBody("""{"user":$userJson}"""))
        server.enqueue(MockResponse().setBody("""{"user":$userJson}"""))

        call { api.me() }
        session.token = "jwt-9"
        call { api.me() }

        assertNull(server.takeRequest().getHeader("Authorization"))
        assertEquals("Bearer jwt-9", server.takeRequest().getHeader("Authorization"))
    }

    @Test
    fun `server errors become ApiException with status, message and code`() {
        server.enqueue(MockResponse().setResponseCode(409).setBody("""{"error":"That handle is already taken","code":"handle_taken"}"""))

        val error = failure { api.register(RegisterRequest("a@x.com", "asha", "password1", true)) }

        assertEquals(409, error.status)
        assertEquals("handle_taken", error.code)
        assertEquals("That handle is already taken", error.message)
        assertFalse(error.isNetwork)
    }

    @Test
    fun `an error response without a JSON body still produces a usable error`() {
        server.enqueue(MockResponse().setResponseCode(502).setBody("<html>Bad gateway</html>"))
        val error = failure { api.chats() }
        assertEquals(502, error.status)
        assertNull(error.code)
    }

    @Test
    fun `a 401 on a signed-in request tells the app the session is dead`() {
        var rejected = 0
        session.onRejected = { rejected++ }
        session.token = "expired"
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"Session expired. Please sign in again."}"""))

        val error = failure { api.chats() }

        assertTrue(error.isUnauthorized)
        assertEquals(1, rejected)
    }

    @Test
    fun `a 401 while signed out, such as wrong login details, does not trigger sign-out handling`() {
        var rejected = 0
        session.onRejected = { rejected++ }
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"Incorrect email/handle or password"}"""))

        failure { api.login(app.textsy.data.model.LoginRequest("asha", "wrongpass")) }

        assertEquals(0, rejected)
    }

    @Test
    fun `a wrong password when deleting the account does not sign the user out`() {
        var rejected = 0
        session.onRejected = { rejected++ }
        session.token = "valid"
        server.enqueue(MockResponse().setResponseCode(403).setBody("""{"error":"Incorrect password","code":"wrong_password"}"""))

        val error = failure { api.deleteAccount(PasswordRequest("nope")) }

        assertEquals("wrong_password", error.code)
        assertEquals(0, rejected)
        val request = server.takeRequest()
        assertEquals("DELETE", request.method)
        assertEquals("nope", Json.parseToJsonElement(request.body.readUtf8()).jsonObject["password"]!!.jsonPrimitive.content)
    }

    @Test
    fun `an unreachable server is reported as a network error`() {
        server.shutdown()
        val error = failure { api.chats() }
        assertTrue(error.isNetwork)
        assertEquals(ApiException.CODE_NETWORK, error.code)
    }

    @Test
    fun `a body that is not what the API promised is reported, not crashed on`() {
        server.enqueue(MockResponse().setBody("""{"chats": "not a list"}"""))
        val error = failure { api.chats() }
        assertEquals(ApiException.CODE_BAD_RESPONSE, error.code)
    }

    @Test
    fun `discovery sends its filters as query parameters and omits unset ones`() {
        server.enqueue(MockResponse().setBody("""{"users":[{"id":"u2","handle":"ravi","sharedInterests":["chess"]}],"hasMore":true}"""))
        server.enqueue(MockResponse().setBody("""{"users":[],"hasMore":false}"""))

        val page = call { api.discover(tag = "chess", limit = 20, skip = 40) }
        call { api.discover() }

        assertEquals(listOf("chess"), page.users.single().sharedInterests)
        assertTrue(page.hasMore)
        assertEquals("/api/users/discover?tag=chess&limit=20&skip=40", server.takeRequest().path)
        assertEquals("/api/users/discover?limit=20&skip=0", server.takeRequest().path)
    }

    @Test
    fun `message history passes the paging cursor`() {
        server.enqueue(
            MockResponse().setBody(
                """{"messages":[{"id":"m1","chatId":"c1","sender":"u1","text":"hi","clientId":null,"createdAt":"2026-01-01T10:00:00.000Z"}],
                "hasMore":true,"nextBefore":"m1"}"""
            )
        )

        val page = call { api.messages("c1", before = "m9", limit = 30) }

        assertEquals("m1", page.nextBefore)
        assertNull(page.messages.single().clientId)
        assertEquals("/api/chats/c1/messages?before=m9&limit=30", server.takeRequest().path)
    }
}
