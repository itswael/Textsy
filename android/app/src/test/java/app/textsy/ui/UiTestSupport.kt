package app.textsy.ui

import androidx.activity.ComponentActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.junit4.AndroidComposeTestRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import app.textsy.AppDependencies
import app.textsy.data.FakeApi
import app.textsy.data.FakeChatSocket
import app.textsy.data.FakeSessionStore
import app.textsy.data.local.StoredSession
import app.textsy.data.model.SelfUser
import app.textsy.data.model.SelfUserResponse
import app.textsy.data.remote.Network
import app.textsy.data.remote.SessionHolder
import app.textsy.data.repo.AuthRepository
import app.textsy.data.repo.ChatRepository
import app.textsy.data.repo.PeopleRepository
import app.textsy.ui.common.LocalContainer
import app.textsy.ui.theme.TextsyTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking

/** The app's dependencies wired to fakes, so a screen can be exercised without a network or database. */
class TestDeps(
    val api: FakeApi = FakeApi(),
    val socket: FakeChatSocket = FakeChatSocket(),
    val store: FakeSessionStore = FakeSessionStore(),
) : AppDependencies {
    private val json = Network.json()
    private val holder = SessionHolder()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)

    override val auth = AuthRepository(api, store, json, holder)
    override val people = PeopleRepository(api, json)
    override val chats = ChatRepository(api, socket, json, scope)

    /** Puts the app in the signed-in state, as if the person had opened it with a saved session. */
    fun signedIn(user: SelfUser): TestDeps {
        api.meResult = { SelfUserResponse(user) }
        store.saved = StoredSession("jwt", user)
        runBlocking { auth.restore() }
        chats.start("jwt", user.id)
        return this
    }
}

typealias ComposeRule = AndroidComposeTestRule<*, ComponentActivity>

fun newComposeRule() = createAndroidComposeRule<ComponentActivity>()

fun ComposeRule.showScreen(deps: AppDependencies, content: @Composable () -> Unit) {
    setContent {
        CompositionLocalProvider(LocalContainer provides deps) {
            TextsyTheme { content() }
        }
    }
}

// ---- Small builders and helpers shared by the screen tests ----

fun publicUser(
    id: String,
    handle: String,
    name: String = handle.replaceFirstChar { it.uppercase() },
    interests: List<String> = emptyList(),
    shared: List<String> = emptyList(),
    bio: String = "",
    area: String = "",
    online: Boolean = false,
) = app.textsy.data.model.PublicUser(
    id = id, handle = handle, displayName = name, interests = interests, sharedInterests = shared,
    bio = bio, area = area, isOnline = online, city = "Meerut",
)

fun chatSummary(
    id: String = "chat-1",
    other: app.textsy.data.model.PublicUser = publicUser("u-ravi", "ravi", "Ravi"),
    last: String? = null,
    lastFrom: String = other.id,
    unread: Int = 0,
    updatedAt: String = "2026-01-01T10:00:00.000Z",
) = app.textsy.data.model.ChatSummary(
    id = id,
    other = other,
    lastMessage = last?.let { app.textsy.data.model.LastMessage("m-$id", it, lastFrom, updatedAt) },
    unread = unread,
    updatedAt = updatedAt,
)

fun serverMessage(id: String, from: String, text: String, at: Int, chatId: String = "chat-1", clientId: String? = null) =
    app.textsy.data.model.ServerMessage(id, chatId, from, text, clientId, "2026-01-01T10:00:%02d.000Z".format(at))

fun ComposeRule.hasTextCount(text: String, substring: Boolean = false): Int =
    onAllNodes(androidx.compose.ui.test.hasText(text, substring = substring)).fetchSemanticsNodes().size

fun ComposeRule.waitForText(text: String, substring: Boolean = false, timeoutMs: Long = 5_000) =
    waitUntil(timeoutMs) { hasTextCount(text, substring) > 0 }

fun ComposeRule.waitForNoText(text: String, substring: Boolean = false, timeoutMs: Long = 5_000) =
    waitUntil(timeoutMs) { hasTextCount(text, substring) == 0 }

/** Waits until some element announces this state to a screen reader, e.g. "3 unread". */
fun ComposeRule.waitForStateDescription(text: String, timeoutMs: Long = 5_000) = waitUntil(timeoutMs) {
    onAllNodes(androidx.compose.ui.test.SemanticsMatcher.expectValue(androidx.compose.ui.semantics.SemanticsProperties.StateDescription, text))
        .fetchSemanticsNodes().isNotEmpty()
}

/** Types into the field with this label, scrolling it into view first like a person would. */
fun ComposeRule.typeInto(label: String, text: String) {
    onNodeWithText(label).performScrollTo().performTextInput(text)
}
