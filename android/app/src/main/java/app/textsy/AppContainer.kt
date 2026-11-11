package app.textsy

import android.content.Context
import app.textsy.data.local.KeystoreSessionStore
import app.textsy.data.remote.Network
import app.textsy.data.remote.SessionHolder
import app.textsy.data.remote.SocketIoChatSocket
import app.textsy.data.repo.AuthRepository
import app.textsy.data.repo.ChatRepository
import app.textsy.data.repo.PeopleRepository
import app.textsy.data.repo.SessionState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

/**
 * Builds and wires the app's long-lived objects by hand (no DI framework: there are few of them).
 * Created once by [TextsyApp] and reached from the UI through [LocalContainer].
 */
class AppContainer(context: Context) : AppDependencies {
    private val json = Network.json()
    private val session = SessionHolder()
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    private val api = Network.api(
        baseUrl = BuildConfig.API_BASE_URL,
        client = Network.okHttp(session, debug = BuildConfig.DEBUG),
        json = json,
    )

    override val auth = AuthRepository(api, KeystoreSessionStore(context, json), json, session)
    override val people = PeopleRepository(api, json)
    override val chats = ChatRepository(api, SocketIoChatSocket(BuildConfig.API_BASE_URL, json), json, appScope)

    init {
        // The server says the session is no longer valid: sign out and show the login screen.
        session.onRejected = { appScope.launch { auth.signOut() } }
        chats.onAuthRejected = { appScope.launch { auth.signOut() } }

        // Keep the live connection open exactly while somebody is signed in. Profile edits re-emit the
        // signed-in state, so only react when the person themselves changes.
        appScope.launch {
            auth.state
                .filter { it !is SessionState.Loading }
                .map { (it as? SessionState.SignedIn)?.user?.id }
                .distinctUntilChanged()
                .collect { userId ->
                    val token = auth.token
                    if (userId != null && token != null) chats.start(token, userId) else chats.stop()
                }
        }

        appScope.launch { auth.restore() }
    }
}
