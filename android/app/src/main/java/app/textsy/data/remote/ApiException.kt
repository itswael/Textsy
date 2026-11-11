package app.textsy.data.remote

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import retrofit2.HttpException
import java.io.IOException

/**
 * Every failure of a backend call, in one type.
 *
 * [status] is the HTTP status, or 0 when no response was received (offline, timeout).
 * [code] is the backend's machine-readable reason when it sent one, e.g. `handle_taken`.
 * [message] is the backend's English text; the UI shows a translated string for known codes.
 */
class ApiException(
    val status: Int,
    override val message: String,
    val code: String? = null,
) : Exception(message) {
    val isNetwork: Boolean get() = status == 0
    val isUnauthorized: Boolean get() = status == 401
    val isBanned: Boolean get() = code == "banned"

    companion object {
        const val CODE_NETWORK = "network"
        const val CODE_BAD_RESPONSE = "bad_response"
    }
}

@Serializable
private data class ErrorBody(val error: String? = null, val code: String? = null)

/** Runs a backend call and converts every failure into [ApiException]. Cancellation passes through untouched. */
suspend fun <T> apiCall(json: Json, block: suspend () -> T): T =
    try {
        block()
    } catch (e: HttpException) {
        val raw = runCatching { e.response()?.errorBody()?.string() }.getOrNull()
        val body = raw?.let { runCatching { json.decodeFromString<ErrorBody>(it) }.getOrNull() }
        throw ApiException(e.code(), body?.error ?: "Request failed (${e.code()})", body?.code)
    } catch (e: IOException) {
        throw ApiException(0, "Cannot reach the server", ApiException.CODE_NETWORK)
    } catch (e: SerializationException) {
        throw ApiException(0, "Unexpected response from the server", ApiException.CODE_BAD_RESPONSE)
    }
