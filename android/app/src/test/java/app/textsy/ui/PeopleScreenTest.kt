package app.textsy.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.textsy.data.httpError
import app.textsy.data.model.ChatResponse
import app.textsy.data.model.UsersResponse
import app.textsy.data.sampleUser
import app.textsy.ui.people.PeopleScreen
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.shadows.ShadowLooper
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class PeopleScreenTest {
    @get:Rule
    val rule = newComposeRule()
    private val deps = TestDeps().signedIn(sampleUser(id = "me", interests = listOf("cricket", "chess")))
    private var openedChat: String? = null

    private val ravi = publicUser("u-ravi", "ravi", "Ravi Kumar", interests = listOf("cricket", "music"), shared = listOf("cricket"),
        bio = "Weekend batsman.", area = "Civil Lines")
    private val priya = publicUser("u-priya", "priya", "Priya", interests = listOf("art"))

    private fun show() = rule.showScreen(deps) { PeopleScreen(onOpenChat = { openedChat = it }) }

    @Test
    fun `shows people nearby with what you have in common`() {
        deps.api.discoverResult = { _, _ -> UsersResponse(listOf(ravi, priya)) }
        show()

        rule.waitForText("Ravi Kumar")
        rule.onNodeWithText("Nearby in Meerut").assertIsDisplayed()
        rule.onNodeWithText("@ravi · Civil Lines").assertIsDisplayed()
        rule.onNodeWithText("Weekend batsman.").assertIsDisplayed()
        rule.onNodeWithText("You both like cricket").assertIsDisplayed()
        // Someone with nothing in common just shows their own interests.
        rule.onNodeWithText("Priya").assertIsDisplayed()
        rule.onNodeWithText("art").assertIsDisplayed()
    }

    @Test
    fun `my own interests become filter chips and tapping one asks the server for that interest`() {
        deps.api.discoverResult = { tag, _ -> UsersResponse(if (tag == "chess") listOf(priya) else listOf(ravi, priya)) }
        show()
        rule.waitForText("Ravi Kumar")
        rule.onNodeWithText("All").assertIsDisplayed()

        rule.onNodeWithText("chess").performClick()

        rule.waitForNoText("Ravi Kumar")
        assertEquals("chess", deps.api.discoverCalls.last().first)

        // Tapping the same chip again clears the filter.
        rule.onNodeWithText("chess").performClick()
        rule.waitForText("Ravi Kumar")
        assertEquals(null, deps.api.discoverCalls.last().first)
    }

    @Test
    fun `searching waits for a pause in typing and then shows matches`() {
        deps.api.discoverResult = { _, _ -> UsersResponse(listOf(ravi, priya)) }
        deps.api.searchResult = { UsersResponse(listOf(priya)) }
        show()
        rule.waitForText("Ravi Kumar")

        rule.onNodeWithText("Search by name, handle or interest").performTextInput("pri")
        assertTrue("no request on every keystroke", deps.api.searchCalls.isEmpty())

        ShadowLooper.idleMainLooper(500, TimeUnit.MILLISECONDS)
        rule.waitUntil(5_000) { deps.api.searchCalls.isNotEmpty() }
        assertEquals(listOf("pri"), deps.api.searchCalls)
        rule.waitForNoText("Ravi Kumar")
        rule.onNodeWithText("Priya").assertIsDisplayed()
    }

    @Test
    fun `saying hi opens the conversation with that person`() {
        deps.api.discoverResult = { _, _ -> UsersResponse(listOf(ravi)) }
        deps.api.openChatResult = { ChatResponse(chatSummary("chat-77", ravi)) }
        show()
        rule.waitForText("Ravi Kumar")

        rule.onNodeWithText("Say hi").performClick()

        rule.waitUntil(5_000) { openedChat != null }
        assertEquals("chat-77", openedChat)
        assertEquals(listOf("ravi"), deps.api.openChatCalls)
    }

    @Test
    fun `if the chat cannot be opened the person is told and stays on the list`() {
        deps.api.discoverResult = { _, _ -> UsersResponse(listOf(ravi)) }
        deps.api.openChatResult = { throw httpError(404, "User not found") }
        show()
        rule.waitForText("Ravi Kumar")

        rule.onNodeWithText("Say hi").performClick()

        rule.waitForText("Couldn't open the chat.")
        assertEquals(null, openedChat)
    }

    @Test
    fun `an empty result explains what to try`() {
        show()
        rule.waitForText("No one here yet")
        rule.onNodeWithText("Try another interest, or invite a friend to join.").assertIsDisplayed()
    }

    @Test
    fun `a network failure can be retried`() {
        deps.api.discoverResult = { _, _ -> throw java.io.IOException("offline") }
        show()
        rule.waitForText("Can't reach Textsy. Check your internet connection and try again.")

        deps.api.discoverResult = { _, _ -> UsersResponse(listOf(ravi)) }
        rule.onNodeWithText("Retry").performClick()
        rule.waitForText("Ravi Kumar")
    }

    @Test
    fun `more results load as a second page and are appended`() {
        val first = (1..20).map { publicUser("u$it", "person$it", "Person $it") }
        val second = listOf(publicUser("u21", "person21", "Person 21"))
        deps.api.discoverResult = { _, skip -> if (skip == 0) UsersResponse(first, hasMore = true) else UsersResponse(second, hasMore = false) }
        show()
        rule.waitForText("Person 1")

        // The button is the last item of a lazy list, so it only exists once the list is scrolled there.
        // Two things scroll (the filter chips and the list); the list is the last one on screen.
        rule.onAllNodes(hasScrollAction()).onLast().performScrollToNode(hasText("Show more"))
        rule.onNodeWithText("Show more").performClick()

        rule.waitUntil(5_000) { deps.api.discoverCalls.any { it.second == 20 } }
        rule.waitForText("Person 21")
    }
}
