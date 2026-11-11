package app.textsy.data.model

import kotlinx.serialization.Serializable

/** What any signed-in user may see about another person. Mirrors the backend's public profile. */
@Serializable
data class PublicUser(
    val id: String,
    val handle: String,
    val displayName: String = "",
    val bio: String = "",
    val avatar: String = "🙂",
    val interests: List<String> = emptyList(),
    val languages: List<String> = emptyList(),
    val city: String = "",
    val area: String = "",
    val isOnline: Boolean = false,
    val lastSeen: String? = null,
    /** Only present in discovery results. */
    val sharedInterests: List<String> = emptyList(),
) {
    val name: String get() = displayName.ifBlank { handle }
}

@Serializable
data class Preferences(
    val language: String = "en",
    val notifications: Boolean = true,
    val showOnlineStatus: Boolean = true,
    val showLastSeen: Boolean = true,
)

/** The signed-in user's own account, including the private email. */
@Serializable
data class SelfUser(
    val id: String,
    val handle: String,
    val email: String,
    val displayName: String = "",
    val bio: String = "",
    val avatar: String = "🙂",
    val interests: List<String> = emptyList(),
    val languages: List<String> = emptyList(),
    val city: String = "",
    val area: String = "",
    val ageConfirmed: Boolean = true,
    val preferences: Preferences = Preferences(),
) {
    val name: String get() = displayName.ifBlank { handle }
}

@Serializable
data class LastMessage(
    val id: String,
    val text: String,
    val sender: String,
    val createdAt: String,
)

@Serializable
data class ChatSummary(
    val id: String,
    val other: PublicUser,
    val lastMessage: LastMessage? = null,
    val unread: Int = 0,
    val updatedAt: String,
)

/** A message exactly as the server stores it. */
@Serializable
data class ServerMessage(
    val id: String,
    val chatId: String,
    val sender: String,
    val text: String,
    val clientId: String? = null,
    val createdAt: String,
)

enum class MessageStatus { SENDING, FAILED, SENT }

/**
 * A message as the UI shows it. Messages the user just typed exist locally
 * (SENDING/FAILED, id "local-<clientId>") until the server confirms them.
 * Timestamps are ISO-8601 UTC strings, which sort correctly as text.
 */
data class ChatMessage(
    val id: String,
    val chatId: String,
    val sender: String,
    val text: String,
    val clientId: String?,
    val createdAt: String,
    val status: MessageStatus,
) {
    companion object {
        fun from(server: ServerMessage) = ChatMessage(
            id = server.id,
            chatId = server.chatId,
            sender = server.sender,
            text = server.text,
            clientId = server.clientId,
            createdAt = server.createdAt,
            status = MessageStatus.SENT,
        )
    }
}

// ---- Requests ----

@Serializable
data class RegisterRequest(
    val email: String,
    val handle: String,
    val password: String,
    val ageConfirmed: Boolean,
    val displayName: String? = null,
    val inviteCode: String? = null,
    val city: String? = null,
    val area: String? = null,
    val interests: List<String>? = null,
    val language: String? = null,
)

@Serializable
data class LoginRequest(val identifier: String, val password: String)

@Serializable
data class PasswordRequest(val password: String)

@Serializable
data class OpenChatRequest(val handle: String)

@Serializable
data class PreferencesPatch(
    val language: String? = null,
    val notifications: Boolean? = null,
    val showOnlineStatus: Boolean? = null,
    val showLastSeen: Boolean? = null,
)

@Serializable
data class UpdateProfileRequest(
    val displayName: String? = null,
    val bio: String? = null,
    val avatar: String? = null,
    val area: String? = null,
    val interests: List<String>? = null,
    val languages: List<String>? = null,
    val preferences: PreferencesPatch? = null,
)

// ---- Responses ----

@Serializable
data class AuthResponse(val token: String, val user: SelfUser)

@Serializable
data class SelfUserResponse(val user: SelfUser)

@Serializable
data class PublicUserResponse(val user: PublicUser)

@Serializable
data class UsersResponse(val users: List<PublicUser> = emptyList(), val hasMore: Boolean = false)

@Serializable
data class ChatsResponse(val chats: List<ChatSummary> = emptyList())

@Serializable
data class ChatResponse(val chat: ChatSummary)

@Serializable
data class MessagesResponse(
    val messages: List<ServerMessage> = emptyList(),
    val hasMore: Boolean = false,
    val nextBefore: String? = null,
)

@Serializable
data class OkResponse(val success: Boolean = true)

// ---- Realtime events ----

@Serializable
data class MessageNewEvent(val message: ServerMessage)

@Serializable
data class ChatUpdatedEvent(
    val chatId: String,
    val lastMessage: LastMessage? = null,
    val unread: Int? = null,
)

@Serializable
data class ChatReadEvent(val chatId: String, val userId: String, val readAt: String)

@Serializable
data class TypingEvent(val chatId: String, val userId: String, val isTyping: Boolean)

@Serializable
data class PresenceEvent(val userId: String, val isOnline: Boolean, val lastSeen: String? = null)
