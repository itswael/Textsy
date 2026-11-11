package app.textsy.domain

import app.textsy.data.model.ChatMessage
import app.textsy.data.model.ChatSummary
import app.textsy.data.model.ChatUpdatedEvent
import app.textsy.data.model.MessageStatus
import java.util.UUID

/** Pure functions behind the chat screens. No Android, no network, so they are easy to test. */
object ChatLogic {

    /**
     * Combines messages already on screen with new ones (a fetched page, a live message,
     * or the user's own just-typed message).
     *
     * - A message is never shown twice: confirmed messages are matched by server id.
     * - When the server confirms a message we showed as pending, the pending copy is replaced
     *   (matched by client id), not duplicated.
     * - Confirmed messages are ordered by server time; unsent ones stay at the bottom in the
     *   order they were typed.
     */
    fun mergeMessages(existing: List<ChatMessage>, incoming: List<ChatMessage>): List<ChatMessage> {
        val confirmed = LinkedHashMap<String, ChatMessage>()
        val pending = LinkedHashMap<String, ChatMessage>()

        fun add(message: ChatMessage) {
            if (message.status == MessageStatus.SENT) {
                confirmed[message.id] = message
                message.clientId?.let { pending.remove(it) }
            } else {
                // A confirmed copy always wins over a pending one with the same client id.
                val alreadyConfirmed = message.clientId != null && confirmed.values.any { it.clientId == message.clientId }
                if (!alreadyConfirmed) pending[message.clientId ?: message.id] = message
            }
        }

        existing.forEach(::add)
        incoming.forEach(::add)

        return confirmed.values.sortedWith(compareBy({ it.createdAt }, { it.id })) +
            pending.values.sortedBy { it.createdAt }
    }

    /** Sets the status of the pending message with this client id. Confirmed messages are left alone. */
    fun withStatus(messages: List<ChatMessage>, clientId: String, status: MessageStatus): List<ChatMessage> =
        messages.map { if (it.clientId == clientId && it.status != MessageStatus.SENT) it.copy(status = status) else it }

    /** Most recently active chat first. ISO-8601 UTC timestamps sort correctly as text. */
    fun sortChats(chats: List<ChatSummary>): List<ChatSummary> = chats.sortedByDescending { it.updatedAt }

    /** Applies a live `chat:updated` event. Returns null when the chat is unknown, so the caller can reload the list. */
    fun applyChatUpdate(chats: List<ChatSummary>, event: ChatUpdatedEvent): List<ChatSummary>? {
        if (chats.none { it.id == event.chatId }) return null
        return sortChats(
            chats.map {
                if (it.id != event.chatId) {
                    it
                } else {
                    it.copy(
                        lastMessage = event.lastMessage ?: it.lastMessage,
                        unread = event.unread ?: it.unread,
                        updatedAt = event.lastMessage?.createdAt ?: it.updatedAt,
                    )
                }
            }
        )
    }

    fun upsertChat(chats: List<ChatSummary>, chat: ChatSummary): List<ChatSummary> =
        sortChats(chats.filterNot { it.id == chat.id } + chat)

    /** Unique per message and per device. The server uses it to recognise a retried send. */
    fun newClientId(): String = UUID.randomUUID().toString()
}
