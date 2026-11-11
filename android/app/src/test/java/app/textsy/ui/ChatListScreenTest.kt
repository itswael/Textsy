package app.textsy.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.layout.positionInRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.textsy.data.model.ChatsResponse
import app.textsy.data.sampleUser
import app.textsy.ui.chats.ChatListScreen
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ChatListScreenTest {
    @get:Rule
    val rule = newComposeRule()
    private val deps = TestDeps().signedIn(sampleUser(id = "me"))
    private var openedChat: String? = null
    private var foundPeople = false

    private fun show() = rule.showScreen(deps) {
        ChatListScreen(onOpenChat = { openedChat = it }, onFindPeople = { foundPeople = true })
    }

    @Test
    fun `a new account sees a friendly empty state that leads to People`() {
        show()
        rule.waitForText("No conversations yet")
        rule.onNodeWithText("Find someone with shared interests and say hi.").assertIsDisplayed()
        rule.onNodeWithText("Find people").performClick()
        assertTrue(foundPeople)
    }

    @Test
    fun `conversations show the other person, the last message and an unread badge`() {
        deps.api.chatsResult = {
            ChatsResponse(
                listOf(
                    chatSummary("c1", publicUser("u1", "ravi", "Ravi Kumar"), last = "Are we still on for Sunday?", unread = 3,
                        updatedAt = "2026-01-02T10:00:00.000Z"),
                    chatSummary("c2", publicUser("u2", "priya", "Priya"), last = "See you there", lastFrom = "me",
                        updatedAt = "2026-01-01T10:00:00.000Z"),
                )
            )
        }
        show()

        rule.waitForText("Ravi Kumar")
        rule.onNodeWithText("Are we still on for Sunday?").assertIsDisplayed()
        // The count is announced as "3 unread" on the row, not as a bare number.
        rule.waitForStateDescription("3 unread")
        rule.onNodeWithText("Priya").assertIsDisplayed()
        // The preview of my own message says so.
        rule.onNodeWithText("You: See you there").assertIsDisplayed()
    }

    @Test
    fun `most recently active conversation is listed first`() {
        deps.api.chatsResult = {
            ChatsResponse(
                listOf(
                    chatSummary("old", publicUser("u1", "older", "Older Chat"), last = "x", updatedAt = "2026-01-01T10:00:00.000Z"),
                    chatSummary("new", publicUser("u2", "newer", "Newer Chat"), last = "y", updatedAt = "2026-01-03T10:00:00.000Z"),
                )
            )
        }
        show()
        rule.waitForText("Newer Chat")

        val tops = listOf("Newer Chat", "Older Chat").map {
            rule.onNodeWithText(it).fetchSemanticsNode().positionInRoot.y
        }
        assertTrue("newer chat should be above the older one", tops[0] < tops[1])
    }

    @Test
    fun `tapping a conversation opens it`() {
        deps.api.chatsResult = { ChatsResponse(listOf(chatSummary("c1", publicUser("u1", "ravi", "Ravi"), last = "hi"))) }
        show()
        rule.waitForText("Ravi")
        rule.onNodeWithText("Ravi").performClick()
        assertEquals("c1", openedChat)
    }

    @Test
    fun `the connecting banner shows only while the live connection is down`() {
        show()
        rule.waitForText("Connecting…")

        deps.socket.connected.value = true
        rule.waitForNoText("Connecting…")
    }

    @Test
    fun `a failed load shows an error with a retry that works`() {
        deps.api.chatsResult = { throw java.io.IOException("offline") }
        show()
        rule.waitForText("Couldn't load your chats.")

        deps.api.chatsResult = { ChatsResponse(listOf(chatSummary("c1", publicUser("u1", "ravi", "Ravi"), last = "hi"))) }
        rule.onNodeWithText("Retry").performClick()
        rule.waitForText("Ravi")
    }

    @Test
    fun `a new message arriving live updates the list without a reload`() {
        deps.api.chatsResult = { ChatsResponse(listOf(chatSummary("c1", publicUser("u1", "ravi", "Ravi"), last = "first", unread = 0))) }
        show()
        rule.waitForText("first")
        val reloads = deps.api.chatsCalls

        deps.socket.emit(
            app.textsy.data.remote.SocketEvent.ChatUpdated(
                app.textsy.data.model.ChatUpdatedEvent(
                    "c1", app.textsy.data.model.LastMessage("m2", "just now", "u1", "2026-01-05T10:00:00.000Z"), 1
                )
            )
        )

        rule.waitForText("just now")
        rule.waitForStateDescription("1 unread")
        assertEquals(reloads, deps.api.chatsCalls)
    }
}
