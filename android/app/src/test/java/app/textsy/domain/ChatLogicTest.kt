package app.textsy.domain

import app.textsy.data.model.ChatMessage
import app.textsy.data.model.ChatSummary
import app.textsy.data.model.ChatUpdatedEvent
import app.textsy.data.model.LastMessage
import app.textsy.data.model.MessageStatus
import app.textsy.data.model.PublicUser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ChatLogicTest {

    private fun msg(
        id: String,
        at: String,
        status: MessageStatus = MessageStatus.SENT,
        clientId: String? = null,
        text: String = "text $id",
    ) = ChatMessage(id, "chat", "u1", text, clientId, at, status)

    private fun ids(list: List<ChatMessage>) = list.map { it.id }

    @Test
    fun `confirmed messages are ordered by server time and never duplicated`() {
        val existing = listOf(msg("b", "2026-01-01T10:00:02Z"), msg("a", "2026-01-01T10:00:01Z"))
        val incoming = listOf(msg("b", "2026-01-01T10:00:02Z"), msg("c", "2026-01-01T10:00:03Z"))
        assertEquals(listOf("a", "b", "c"), ids(ChatLogic.mergeMessages(existing, incoming)))
    }

    @Test
    fun `an older page merges in front without duplicating`() {
        val onScreen = listOf(msg("m3", "2026-01-01T10:00:03Z"), msg("m4", "2026-01-01T10:00:04Z"))
        val older = listOf(msg("m1", "2026-01-01T10:00:01Z"), msg("m2", "2026-01-01T10:00:02Z"), msg("m3", "2026-01-01T10:00:03Z"))
        assertEquals(listOf("m1", "m2", "m3", "m4"), ids(ChatLogic.mergeMessages(onScreen, older)))
    }

    @Test
    fun `server confirmation replaces the pending copy instead of adding a second one`() {
        val pending = msg("local-c1", "2026-01-01T10:00:00Z", MessageStatus.SENDING, clientId = "c1")
        val confirmed = msg("srv-1", "2026-01-01T10:00:05Z", clientId = "c1")

        val merged = ChatLogic.mergeMessages(listOf(pending), listOf(confirmed))

        assertEquals(listOf("srv-1"), ids(merged))
        assertEquals(MessageStatus.SENT, merged.single().status)
    }

    @Test
    fun `a late pending copy never overrides an already confirmed message`() {
        val confirmed = msg("srv-1", "2026-01-01T10:00:05Z", clientId = "c1")
        val stalePending = msg("local-c1", "2026-01-01T10:00:00Z", MessageStatus.FAILED, clientId = "c1")

        val merged = ChatLogic.mergeMessages(listOf(confirmed), listOf(stalePending))

        assertEquals(listOf("srv-1"), ids(merged))
    }

    @Test
    fun `unsent messages stay at the bottom in the order they were typed`() {
        val sent = listOf(msg("a", "2026-01-01T10:00:01Z"))
        val first = msg("local-1", "2026-01-01T10:00:10Z", MessageStatus.SENDING, clientId = "1")
        val second = msg("local-2", "2026-01-01T10:00:11Z", MessageStatus.FAILED, clientId = "2")
        // Someone else's message arrives with a later server time than our pending ones.
        val reply = msg("b", "2026-01-01T10:00:20Z")

        val merged = ChatLogic.mergeMessages(sent + first + second, listOf(reply))

        assertEquals(listOf("a", "b", "local-1", "local-2"), ids(merged))
    }

    @Test
    fun `status changes apply only to the matching pending message`() {
        val list = listOf(
            msg("srv-1", "2026-01-01T10:00:01Z", clientId = "c1"),
            msg("local-c2", "2026-01-01T10:00:02Z", MessageStatus.SENDING, clientId = "c2"),
        )
        val changed = ChatLogic.withStatus(list, "c2", MessageStatus.FAILED)
        assertEquals(MessageStatus.SENT, changed[0].status)
        assertEquals(MessageStatus.FAILED, changed[1].status)

        // A confirmed message cannot be demoted.
        assertEquals(MessageStatus.SENT, ChatLogic.withStatus(list, "c1", MessageStatus.FAILED)[0].status)
    }

    private fun chat(id: String, updatedAt: String, unread: Int = 0, last: String? = null) = ChatSummary(
        id = id,
        other = PublicUser(id = "u-$id", handle = "h$id"),
        lastMessage = last?.let { LastMessage("m-$id", it, "u-$id", updatedAt) },
        unread = unread,
        updatedAt = updatedAt,
    )

    @Test
    fun `a chat update moves the chat to the top and sets unread and last message`() {
        val chats = listOf(chat("a", "2026-01-01T10:00:09Z"), chat("b", "2026-01-01T10:00:01Z"))
        val last = LastMessage("m9", "hello", "u-b", "2026-01-01T10:00:20Z")

        val updated = ChatLogic.applyChatUpdate(chats, ChatUpdatedEvent("b", last, 3))!!

        assertEquals(listOf("b", "a"), updated.map { it.id })
        assertEquals(3, updated.first().unread)
        assertEquals("hello", updated.first().lastMessage?.text)
        assertEquals("2026-01-01T10:00:20Z", updated.first().updatedAt)
    }

    @Test
    fun `an unread reset leaves the last message alone`() {
        val chats = listOf(chat("a", "2026-01-01T10:00:09Z", unread = 4, last = "keep me"))
        val updated = ChatLogic.applyChatUpdate(chats, ChatUpdatedEvent("a", null, 0))!!
        assertEquals(0, updated.single().unread)
        assertEquals("keep me", updated.single().lastMessage?.text)
    }

    @Test
    fun `an update for an unknown chat asks the caller to reload`() {
        assertNull(ChatLogic.applyChatUpdate(listOf(chat("a", "2026-01-01T10:00:09Z")), ChatUpdatedEvent("zzz", null, 1)))
    }

    @Test
    fun `upserting replaces an existing chat and keeps newest first`() {
        val chats = listOf(chat("a", "2026-01-01T10:00:01Z"), chat("b", "2026-01-01T10:00:02Z"))
        val result = ChatLogic.upsertChat(chats, chat("a", "2026-01-01T10:00:09Z", unread = 1))
        assertEquals(listOf("a", "b"), result.map { it.id })
        assertEquals(1, result.first().unread)
    }

    @Test
    fun `client ids are unique and within the server limit`() {
        val ids = List(1000) { ChatLogic.newClientId() }
        assertEquals(1000, ids.toSet().size)
        assertEquals(true, ids.all { it.length in 1..64 })
    }
}
