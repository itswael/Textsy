package app.textsy.data.repo

import app.textsy.data.local.SessionStore
import app.textsy.data.local.StoredSession
import app.textsy.data.model.AuthResponse
import app.textsy.data.model.LoginRequest
import app.textsy.data.model.PasswordRequest
import app.textsy.data.model.RegisterRequest
import app.textsy.data.model.SelfUser
import app.textsy.data.model.UpdateProfileRequest
import app.textsy.data.remote.ApiException
import app.textsy.data.remote.SessionHolder
import app.textsy.data.remote.TextsyApi
import app.textsy.data.remote.apiCall
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.Json

sealed interface SessionState {
    /** Checking for a saved session at app start. */
    data object Loading : SessionState
    data object SignedOut : SessionState
    data class SignedIn(val user: SelfUser) : SessionState
}

/** Owns who is signed in: sign up, sign in, restore on launch, profile changes, sign out and account deletion. */
class AuthRepository(
    private val api: TextsyApi,
    private val store: SessionStore,
    private val json: Json,
    private val holder: SessionHolder,
) {
    private val _state = MutableStateFlow<SessionState>(SessionState.Loading)
    val state: StateFlow<SessionState> = _state.asStateFlow()

    val token: String? get() = holder.token

    /** Called once at app start. Signs in from the saved session if there is one and the server still accepts it. */
    suspend fun restore() {
        val saved = store.load()
        if (saved == null) {
            _state.value = SessionState.SignedOut
            return
        }
        holder.token = saved.token
        try {
            val user = apiCall(json) { api.me() }.user
            store.save(StoredSession(saved.token, user))
            _state.value = SessionState.SignedIn(user)
        } catch (e: ApiException) {
            when {
                e.isUnauthorized || e.status == 403 -> endSession()
                // Offline or a server hiccup: open the app with what we know rather than logging people out.
                else -> _state.value = SessionState.SignedIn(saved.user)
            }
        }
    }

    suspend fun register(request: RegisterRequest): SelfUser =
        beginSession(apiCall(json) { api.register(request) })

    suspend fun login(identifier: String, password: String): SelfUser =
        beginSession(apiCall(json) { api.login(LoginRequest(identifier.trim(), password)) })

    suspend fun updateProfile(request: UpdateProfileRequest): SelfUser {
        val user = apiCall(json) { api.updateMe(request) }.user
        holder.token?.let { store.save(StoredSession(it, user)) }
        _state.value = SessionState.SignedIn(user)
        return user
    }

    /** Permanently deletes the account on the server, then signs out. */
    suspend fun deleteAccount(password: String) {
        apiCall(json) { api.deleteAccount(PasswordRequest(password)) }
        endSession()
    }

    suspend fun signOut() = endSession()

    private suspend fun beginSession(response: AuthResponse): SelfUser {
        holder.token = response.token
        store.save(StoredSession(response.token, response.user))
        _state.value = SessionState.SignedIn(response.user)
        return response.user
    }

    private suspend fun endSession() {
        holder.token = null
        store.clear()
        _state.value = SessionState.SignedOut
    }
}
