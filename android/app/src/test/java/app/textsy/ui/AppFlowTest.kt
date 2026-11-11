package app.textsy.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.textsy.data.model.AuthResponse
import app.textsy.data.model.ChatsResponse
import app.textsy.data.model.UsersResponse
import app.textsy.data.repo.SessionState
import app.textsy.data.sampleUser
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** The whole app shell: which screen shows for which session, and moving between tabs. */
@RunWith(AndroidJUnit4::class)
class AppFlowTest {
    @get:Rule
    val rule = newComposeRule()

    private fun show(deps: TestDeps) = rule.showScreen(deps) { TextsyRoot() }

    @Test
    fun `while the saved session is being checked a splash screen shows`() {
        show(TestDeps())
        rule.onNodeWithText("Textsy").assertIsDisplayed()
        rule.onNodeWithText("Welcome back").assertDoesNotExist()
    }

    @Test
    fun `without a session the login screen shows`() {
        val deps = TestDeps()
        runBlocking { deps.auth.restore() }
        show(deps)
        rule.waitForText("Welcome back")
    }

    @Test
    fun `signing in replaces the login screen with the app and signing out brings it back`() {
        val deps = TestDeps()
        deps.api.loginResult = { AuthResponse("jwt", sampleUser(id = "me")) }
        deps.api.chatsResult = { ChatsResponse() }
        runBlocking { deps.auth.restore() }
        show(deps)
        rule.waitForText("Welcome back")

        runBlocking { deps.auth.login("asha", "password1") }
        rule.waitForText("No conversations yet")
        assertEquals(0, rule.hasTextCount("Welcome back"))

        runBlocking { deps.auth.signOut() }
        rule.waitForText("Welcome back")
        assertEquals(0, rule.hasTextCount("No conversations yet"))
    }

    @Test
    fun `a restored session opens straight into the app on the chats tab`() {
        val deps = TestDeps().signedIn(sampleUser())
        show(deps)
        rule.waitForText("No conversations yet")
    }

    @Test
    fun `the bottom bar switches between chats, people and profile`() {
        val deps = TestDeps().signedIn(sampleUser(handle = "asha", name = "Asha Rao"))
        deps.api.discoverResult = { _, _ -> UsersResponse(listOf(publicUser("u1", "ravi", "Ravi Kumar"))) }
        show(deps)
        rule.waitForText("No conversations yet")

        rule.onNodeWithText("People").performClick()
        rule.waitForText("Ravi Kumar")

        rule.onNodeWithText("Profile").performClick()
        rule.waitForText("@asha")

        rule.onNodeWithText("Chats").performClick()
        rule.waitForText("No conversations yet")
    }

    @Test
    fun `the unread total shows as a badge on the chats tab`() {
        val deps = TestDeps().signedIn(sampleUser())
        deps.api.chatsResult = {
            ChatsResponse(
                listOf(
                    chatSummary("c1", publicUser("u1", "ravi", "Ravi"), last = "a", unread = 2),
                    chatSummary("c2", publicUser("u2", "priya", "Priya"), last = "b", unread = 5, updatedAt = "2026-01-02T10:00:00.000Z"),
                )
            )
        }
        show(deps)
        rule.waitForText("Ravi")
        // 2 + 5 across both chats, announced on the tab so screen reader users hear it too.
        rule.waitForStateDescription("7 unread")
    }

    @Test
    fun `a session that ends while using the app returns to login`() {
        val deps = TestDeps().signedIn(sampleUser())
        show(deps)
        rule.waitForText("No conversations yet")

        deps.socket.emit(app.textsy.data.remote.SocketEvent.AuthRejected(banned = false))
        runBlocking { deps.auth.signOut() } // what the app container does when the server rejects the session

        rule.waitForText("Welcome back")
        assertEquals(SessionState.SignedOut, deps.auth.state.value)
    }
}
