package app.textsy.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.textsy.data.model.ChatReadEvent
import app.textsy.data.model.ChatsResponse
import app.textsy.data.model.MessagesResponse
import app.textsy.data.model.TypingEvent
import app.textsy.data.remote.SendResult
import app.textsy.data.remote.SocketEvent
import app.textsy.data.sampleUser
import app.textsy.ui.chats.ChatScreen
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ChatScreenTest {
    @get:Rule
    val rule = newComposeRule()
    private val deps = TestDeps().signedIn(sampleUser(id = "me"))
    private val ravi = publicUser("u-ravi", "ravi", "Ravi Kumar", online = true)
    private var wentBack = false

    private fun show(history: List<app.textsy.data.model.ServerMessage> = emptyList()) {
        deps.api.chatsResult = { ChatsResponse(listOf(chatSummary("chat-1", ravi))) }
        deps.api.messagesResult = { _, _ -> MessagesResponse(history) }
        runBlocking { deps.chats.refreshChats() }
        rule.showScreen(deps) { ChatScreen(chatId = "chat-1", onBack = { wentBack = true }) }
    }

    private fun type(text: String) = rule.onNodeWithText("Message").performTextInput(text)
    private fun send() = rule.onNodeWithContentDescription("Send").performClick()

    @Test
    fun `shows who you are talking to, their status and both sides of the conversation`() {
        show(listOf(serverMessage("m1", "u-ravi", "Namaste!", 1), serverMessage("m2", "me", "Hello Ravi", 2)))

        rule.waitForText("Ravi Kumar")
        rule.onNodeWithText("Online").assertIsDisplayed()
        rule.waitForText("Namaste!")
        rule.onNodeWithText("Hello Ravi").assertIsDisplayed()
    }

    @Test
    fun `an empty conversation invites you to say hello`() {
        show()
        rule.waitForText("Say hello 👋")
        rule.onNodeWithText("Start the conversation with @ravi.").assertIsDisplayed()
    }

    @Test
    fun `my message is marked seen only after the other person has read it`() {
        show(listOf(serverMessage("m1", "me", "Did you get my note?", 1)))
        rule.waitForText("Sent", substring = true)
        assertEquals(0, rule.hasTextCount("Seen", substring = true))

        deps.socket.emit(SocketEvent.ChatRead(ChatReadEvent("chat-1", "u-ravi", "2026-01-01T10:05:00.000Z")))

        rule.waitForText("Seen", substring = true)
    }

    @Test
    fun `typing indicator appears in the header while the other person types`() {
        show()
        rule.waitForText("Ravi Kumar")

        deps.socket.emit(SocketEvent.Typing(TypingEvent("chat-1", "u-ravi", true)))
        rule.waitForText("typing…")

        deps.socket.emit(SocketEvent.Typing(TypingEvent("chat-1", "u-ravi", false)))
        rule.waitForNoText("typing…")
    }

    @Test
    fun `typing a message and pressing send shows it at once and sends it with a client id`() {
        deps.socket.sendHandler = { _, text, clientId ->
            SendResult.Delivered(serverMessage("srv-1", "me", text, 9, clientId = clientId), false)
        }
        show()
        rule.waitForText("Say hello 👋")

        type("Kaise ho?")
        send()

        rule.waitForText("Kaise ho?")
        rule.waitUntil(5_000) { deps.socket.sendAttempts.isNotEmpty() }
        val (chatId, text, clientId) = deps.socket.sendAttempts.single()
        assertEquals("chat-1", chatId)
        assertEquals("Kaise ho?", text)
        assertTrue(clientId.isNotBlank())
        // The composer is cleared and the message shows as sent.
        rule.waitForText("Sent", substring = true)
    }

    @Test
    fun `the send button does nothing for an empty or blank message`() {
        show()
        rule.waitForText("Say hello 👋")
        type("   ")
        send()
        rule.waitForIdle()
        assertTrue(deps.socket.sendAttempts.isEmpty())
    }

    @Test
    fun `a message that could not be sent says so and a tap retries it`() {
        show()
        rule.waitForText("Say hello 👋")

        type("Are you free?")
        send()
        rule.waitForText("Not sent. Tap to retry.")
        assertEquals(1, deps.socket.sendAttempts.size)

        deps.socket.sendHandler = { _, text, clientId ->
            SendResult.Delivered(serverMessage("srv-1", "me", text, 9, clientId = clientId), false)
        }
        rule.onNodeWithText("Are you free?").performClick()

        rule.waitForNoText("Not sent. Tap to retry.")
        rule.waitForText("Sent", substring = true)
        assertEquals("the retry reuses the same client id", 1, deps.socket.sendAttempts.map { it.third }.toSet().size)
    }

    @Test
    fun `a live message from the other person appears without any reload`() {
        show()
        rule.waitForText("Say hello 👋")

        deps.socket.emit(SocketEvent.NewMessage(serverMessage("m9", "u-ravi", "Just landed!", 9)))

        rule.waitForText("Just landed!")
    }

    @Test
    fun `while the chat is open, incoming messages are marked read`() {
        show()
        rule.waitForText("Say hello 👋")
        deps.socket.readMarks.clear()

        deps.socket.emit(SocketEvent.NewMessage(serverMessage("m9", "u-ravi", "ping", 9)))

        rule.waitUntil(5_000) { deps.socket.readMarks.contains("chat-1") }
    }

    @Test
    fun `a failed history load can be retried`() {
        deps.api.chatsResult = { ChatsResponse(listOf(chatSummary("chat-1", ravi))) }
        deps.api.messagesResult = { _, _ -> throw java.io.IOException("offline") }
        runBlocking { deps.chats.refreshChats() }
        rule.showScreen(deps) { ChatScreen(chatId = "chat-1", onBack = {}) }
        rule.waitForText("Couldn't load messages.")

        deps.api.messagesResult = { _, _ -> MessagesResponse(listOf(serverMessage("m1", "u-ravi", "finally", 1))) }
        rule.onNodeWithText("Retry").performClick()

        rule.waitForText("finally")
    }

    @Test
    fun `blocking from the menu asks first, then blocks and leaves the chat`() {
        show()
        rule.waitForText("Ravi Kumar")

        rule.onNodeWithContentDescription("More options").performClick()
        rule.onNodeWithText("Block @ravi").performClick()
        rule.onNodeWithText("Block @ravi?").assertIsDisplayed()
        assertTrue("nothing is blocked until confirmed", deps.api.blockCalls.isEmpty())

        rule.onNodeWithText("Block").performClick()

        rule.waitUntil(5_000) { wentBack }
        assertEquals(listOf("ravi"), deps.api.blockCalls)
    }

    @Test
    fun `cancelling the block dialog changes nothing`() {
        show()
        rule.waitForText("Ravi Kumar")
        rule.onNodeWithContentDescription("More options").performClick()
        rule.onNodeWithText("Block @ravi").performClick()

        rule.onNodeWithText("Cancel").performClick()

        rule.waitForNoText("Block @ravi?")
        assertTrue(deps.api.blockCalls.isEmpty())
        assertTrue(!wentBack)
    }

    @Test
    fun `the back arrow leaves the chat`() {
        show()
        rule.waitForText("Ravi Kumar")
        rule.onNodeWithContentDescription("Back").performClick()
        assertTrue(wentBack)
    }
}
