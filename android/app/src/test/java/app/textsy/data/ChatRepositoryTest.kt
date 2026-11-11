package app.textsy.data

import app.textsy.data.model.ChatMessage
import app.textsy.data.model.ChatReadEvent
import app.textsy.data.model.ChatResponse
import app.textsy.data.model.ChatSummary
import app.textsy.data.model.ChatUpdatedEvent
import app.textsy.data.model.ChatsResponse
import app.textsy.data.model.LastMessage
import app.textsy.data.model.MessageStatus
import app.textsy.data.model.MessagesResponse
import app.textsy.data.model.PresenceEvent
import app.textsy.data.model.PublicUser
import app.textsy.data.model.ServerMessage
import app.textsy.data.model.TypingEvent
import app.textsy.data.remote.Network
import app.textsy.data.remote.SendResult
import app.textsy.data.remote.SocketEvent
import app.textsy.data.repo.ChatRepository
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ChatRepositoryTest {
    private val me = "me"
    private val chatId = "chat-1"

    private val api = FakeApi()
    private val socket = FakeChatSocket()
    private var counter = 0

    private fun TestScope.repo() = ChatRepository(
        api = api,
        socket = socket,
        json = Network.json(),
        scope = backgroundScope,
        now = { "2026-01-01T10:00:%02d.000Z".format(counter) },
        newClientId = { "client-${++counter}" },
        typingTimeoutMs = 1_000,
    ).also { it.start(token = "jwt", userId = me) }

    private fun server(id: String, from: String, text: String, at: Int, clientId: String? = null) =
        ServerMessage(id, chatId, from, text, clientId, "2026-01-01T10:01:%02d.000Z".format(at))

    private fun summary(unread: Int = 0, updatedAt: String = "2026-01-01T09:00:00.000Z", otherId: String = "other") =
        ChatSummary(chatId, PublicUser(id = otherId, handle = "ravi"), null, unread, updatedAt)

    private fun ChatRepository.messages() = threads.value[chatId]?.messages.orEmpty()

    @Test
    fun `start connects the socket with the session token`() = runTest(UnconfinedTestDispatcher()) {
        repo()
        assertEquals("jwt", socket.connectedWithToken)
    }

    @Test
    fun `a sent message appears at once as sending and becomes sent when the server confirms it`() =
        runTest(UnconfinedTestDispatcher()) {
            val repo = repo()
            socket.connected.value = true
            socket.sendHandler = { cid, text, clientId ->
                SendResult.Delivered(server("srv-1", me, text, 1, clientId), duplicate = false)
            }

            repo.send(chatId, "  hello  ")

            val shown = repo.messages().single()
            assertEquals("srv-1", shown.id)
            assertEquals("hello", shown.text)
            assertEquals(MessageStatus.SENT, shown.status)
            assertEquals("client-1", socket.sendAttempts.single().third)
        }

    @Test
    fun `while waiting for the server the message is visible as sending`() = runTest(UnconfinedTestDispatcher()) {
        val repo = repo()
        val gate = kotlinx.coroutines.CompletableDeferred<SendResult>()
        socket.sendHandler = { _, _, _ -> gate.await() }

        repo.send(chatId, "hi")

        assertEquals(MessageStatus.SENDING, repo.messages().single().status)
        assertEquals("local-client-1", repo.messages().single().id)

        gate.complete(SendResult.Delivered(server("srv-1", me, "hi", 1, "client-1"), false))
        assertEquals(listOf("srv-1"), repo.messages().map { it.id })
    }

    @Test
    fun `blank and oversized messages are ignored`() = runTest(UnconfinedTestDispatcher()) {
        val repo = repo()
        repo.send(chatId, "   ")
        repo.send(chatId, "x".repeat(1001))
        assertTrue(repo.messages().isEmpty())
        assertTrue(socket.sendAttempts.isEmpty())
    }

    @Test
    fun `offline sends fail visibly and are retried automatically on reconnect with the same client id`() =
        runTest(UnconfinedTestDispatcher()) {
            val repo = repo()
            api.chatsResult = { ChatsResponse(listOf(summary())) }

            repo.send(chatId, "are you there?")
            assertEquals(MessageStatus.FAILED, repo.messages().single().status)

            socket.sendHandler = { _, text, clientId -> SendResult.Delivered(server("srv-1", me, text, 1, clientId), false) }
            socket.connected.value = true

            assertEquals(listOf("srv-1"), repo.messages().map { it.id })
            assertEquals(MessageStatus.SENT, repo.messages().single().status)
            val clientIds = socket.sendAttempts.map { it.third }
            assertEquals("the retry must reuse the client id so the server can de-duplicate", listOf("client-1", "client-1"), clientIds)
        }

    @Test
    fun `a message the server rejects fails and is not retried on reconnect`() = runTest(UnconfinedTestDispatcher()) {
        val repo = repo()
        socket.sendHandler = { _, _, _ -> SendResult.Rejected("forbidden", "You cannot message this person") }

        repo.send(chatId, "hello")
        assertEquals(MessageStatus.FAILED, repo.messages().single().status)

        socket.connected.value = true
        assertEquals("only the original attempt", 1, socket.sendAttempts.size)
    }

    @Test
    fun `retry sends a failed message again`() = runTest(UnconfinedTestDispatcher()) {
        val repo = repo()
        repo.send(chatId, "try me")
        assertEquals(MessageStatus.FAILED, repo.messages().single().status)

        socket.sendHandler = { _, text, clientId -> SendResult.Delivered(server("srv-1", me, text, 1, clientId), false) }
        repo.retry(chatId, "client-1")

        assertEquals(MessageStatus.SENT, repo.messages().single().status)
    }

    @Test
    fun `a duplicate acknowledgement does not create a second message`() = runTest(UnconfinedTestDispatcher()) {
        val repo = repo()
        socket.sendHandler = { _, text, clientId -> SendResult.Delivered(server("srv-1", me, text, 1, clientId), duplicate = true) }

        repo.send(chatId, "once")
        // The same message also arrives over the live event (sender gets their own copy).
        socket.emit(SocketEvent.NewMessage(server("srv-1", me, "once", 1, "client-1")))

        assertEquals(listOf("srv-1"), repo.messages().map { it.id })
    }

    @Test
    fun `an incoming message is added once and marks the open chat as read`() = runTest(UnconfinedTestDispatcher()) {
        val repo = repo()
        api.chatsResult = { ChatsResponse(listOf(summary(unread = 0))) }
        repo.refreshChats()
        repo.setActiveChat(chatId)
        socket.readMarks.clear()

        socket.emit(SocketEvent.NewMessage(server("srv-9", "other", "hey", 9)))
        socket.emit(SocketEvent.NewMessage(server("srv-9", "other", "hey", 9)))

        assertEquals(listOf("srv-9"), repo.messages().map { it.id })
        assertEquals(listOf(chatId), socket.readMarks.distinct())
    }

    @Test
    fun `a message in a chat that is not open does not mark it read`() = runTest(UnconfinedTestDispatcher()) {
        val repo = repo()
        socket.emit(SocketEvent.NewMessage(server("srv-9", "other", "hey", 9)))
        assertTrue(socket.readMarks.isEmpty())
        assertEquals(1, repo.messages().size)
    }

    @Test
    fun `marking read clears the unread badge and falls back to REST when the socket is down`() =
        runTest(UnconfinedTestDispatcher()) {
            val repo = repo()
            api.chatsResult = { ChatsResponse(listOf(summary(unread = 3))) }
            repo.refreshChats()
            socket.markReadWorks = false

            repo.markRead(chatId)

            assertEquals(0, repo.chats.value.single().unread)
            assertEquals(listOf(chatId), api.markReadCalls)
        }

    @Test
    fun `a chat update for an unknown chat reloads the list`() = runTest(UnconfinedTestDispatcher()) {
        val repo = repo()
        api.chatsResult = { ChatsResponse(listOf(summary(unread = 1))) }

        socket.emit(SocketEvent.ChatUpdated(ChatUpdatedEvent(chatId, LastMessage("m1", "hi", "other", "2026-01-01T10:00:00.000Z"), 1)))

        assertEquals(1, api.chatsCalls)
        assertEquals(listOf(chatId), repo.chats.value.map { it.id })
    }

    @Test
    fun `a chat update changes the badge and last message in place`() = runTest(UnconfinedTestDispatcher()) {
        val repo = repo()
        api.chatsResult = { ChatsResponse(listOf(summary())) }
        repo.refreshChats()

        socket.emit(
            SocketEvent.ChatUpdated(
                ChatUpdatedEvent(chatId, LastMessage("m2", "latest", "other", "2026-01-01T11:00:00.000Z"), unread = 2)
            )
        )

        assertEquals(2, repo.chats.value.single().unread)
        assertEquals("latest", repo.chats.value.single().lastMessage?.text)
        assertEquals("no extra reload needed for a known chat", 1, api.chatsCalls)
    }

    @Test
    fun `the other person reading the chat is shown, my own read is ignored`() = runTest(UnconfinedTestDispatcher()) {
        val repo = repo()
        socket.emit(SocketEvent.ChatRead(ChatReadEvent(chatId, me, "2026-01-01T10:00:00.000Z")))
        assertNull(repo.threads.value[chatId]?.otherReadAt)

        socket.emit(SocketEvent.ChatRead(ChatReadEvent(chatId, "other", "2026-01-01T10:05:00.000Z")))
        assertEquals("2026-01-01T10:05:00.000Z", repo.threads.value[chatId]?.otherReadAt)
    }

    @Test
    fun `the typing indicator shows and then clears itself if the stop event is lost`() = runTest(UnconfinedTestDispatcher()) {
        val repo = repo()
        socket.emit(SocketEvent.Typing(TypingEvent(chatId, "other", true)))
        assertTrue(repo.threads.value[chatId]!!.otherTyping)

        advanceTimeBy(1_001)

        assertFalse(repo.threads.value[chatId]!!.otherTyping)
    }

    @Test
    fun `my own typing events and a received message clear the indicator`() = runTest(UnconfinedTestDispatcher()) {
        val repo = repo()
        socket.emit(SocketEvent.Typing(TypingEvent(chatId, me, true)))
        assertNull("own typing is ignored", repo.threads.value[chatId])

        socket.emit(SocketEvent.Typing(TypingEvent(chatId, "other", true)))
        socket.emit(SocketEvent.NewMessage(server("srv-1", "other", "done typing", 1)))
        assertFalse(repo.threads.value[chatId]!!.otherTyping)
    }

    @Test
    fun `presence updates the person shown in the chat list`() = runTest(UnconfinedTestDispatcher()) {
        val repo = repo()
        api.chatsResult = { ChatsResponse(listOf(summary(otherId = "other"))) }
        repo.refreshChats()

        socket.emit(SocketEvent.Presence(PresenceEvent("other", true, "2026-01-01T10:00:00.000Z")))
        assertTrue(repo.chats.value.single().other.isOnline)

        socket.emit(SocketEvent.Presence(PresenceEvent("someone-else", true, null)))
        assertTrue("an unrelated person changes nothing", repo.chats.value.single().other.isOnline)
    }

    @Test
    fun `history loads newest first, older pages are added in front and nothing repeats`() = runTest(UnconfinedTestDispatcher()) {
        val repo = repo()
        api.messagesResult = { _, before ->
            if (before == null) {
                MessagesResponse(listOf(server("m3", "other", "3", 3), server("m4", me, "4", 4)), hasMore = true, nextBefore = "m3")
            } else {
                assertEquals("m3", before)
                MessagesResponse(listOf(server("m1", "other", "1", 1), server("m2", me, "2", 2)), hasMore = false, nextBefore = null)
            }
        }

        repo.loadThread(chatId)
        assertEquals(listOf("m3", "m4"), repo.messages().map { it.id })
        assertTrue(repo.threads.value[chatId]!!.hasMore)

        repo.loadOlder(chatId)
        assertEquals(listOf("m1", "m2", "m3", "m4"), repo.messages().map { it.id })
        assertFalse(repo.threads.value[chatId]!!.hasMore)

        // Nothing more to load: asking again must not call the server.
        repo.loadOlder(chatId)
        assertEquals(listOf("m1", "m2", "m3", "m4"), repo.messages().map { it.id })
    }

    @Test
    fun `reloading an open chat keeps the paging position and any unsent message`() = runTest(UnconfinedTestDispatcher()) {
        val repo = repo()
        api.messagesResult = { _, _ -> MessagesResponse(listOf(server("m5", "other", "5", 5)), hasMore = true, nextBefore = "m5") }
        repo.loadThread(chatId)
        repo.send(chatId, "still unsent")

        api.messagesResult = { _, _ -> MessagesResponse(listOf(server("m5", "other", "5", 5), server("m6", "other", "6", 6)), hasMore = false, nextBefore = null) }
        repo.loadThread(chatId)

        val thread = repo.threads.value[chatId]!!
        assertEquals("the first load decided there was older history", true, thread.hasMore)
        assertEquals(listOf("m5", "m6", "local-client-1"), thread.messages.map { it.id })
    }

    @Test
    fun `a failed history load is reported on the thread`() = runTest(UnconfinedTestDispatcher()) {
        val repo = repo()
        api.messagesResult = { _, _ -> throw java.io.IOException("offline") }

        repo.loadThread(chatId)

        val thread = repo.threads.value[chatId]!!
        assertTrue(thread.error!!.isNetwork)
        assertFalse(thread.loading)
        assertFalse(thread.loaded)
    }

    @Test
    fun `opening a chat adds it to the list and returns its id`() = runTest(UnconfinedTestDispatcher()) {
        val repo = repo()
        api.openChatResult = { handle ->
            assertEquals("ravi", handle)
            ChatResponse(summary())
        }

        assertEquals(chatId, repo.openChat("ravi"))
        assertEquals(listOf(chatId), repo.chats.value.map { it.id })
    }

    @Test
    fun `an auth rejection from the socket is passed on`() = runTest(UnconfinedTestDispatcher()) {
        val repo = repo()
        var banned: Boolean? = null
        repo.onAuthRejected = { banned = it }

        socket.emit(SocketEvent.AuthRejected(banned = true))

        assertEquals(true, banned)
    }

    @Test
    fun `stop disconnects and forgets everything`() = runTest(UnconfinedTestDispatcher()) {
        val repo = repo()
        api.chatsResult = { ChatsResponse(listOf(summary())) }
        repo.refreshChats()
        repo.send(chatId, "queued")

        repo.stop()

        assertTrue(repo.chats.value.isEmpty())
        assertTrue(repo.threads.value.isEmpty())
        assertTrue(socket.disconnectCount >= 1)
        // Events after sign-out are not processed.
        socket.emit(SocketEvent.NewMessage(server("srv-1", "other", "late", 1)))
        assertTrue(repo.threads.value.isEmpty())
    }

    @Test
    fun `messages from before sign-out are not retried for the next account`() = runTest(UnconfinedTestDispatcher()) {
        val repo = repo()
        repo.send(chatId, "from the old account")
        repo.stop()

        repo.start("jwt-2", "someone-else")
        socket.sendHandler = { _, text, clientId -> SendResult.Delivered(server("srv-1", "someone-else", text, 1, clientId), false) }
        socket.connected.value = true

        assertEquals("only the first, failed attempt was ever made", 1, socket.sendAttempts.size)
        assertTrue(repo.threads.value.values.all { it.messages.none { m: ChatMessage -> m.status == MessageStatus.SENT } })
    }
}
