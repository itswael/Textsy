package app.textsy.data.repo

import app.textsy.data.model.PublicUser
import app.textsy.data.model.UsersResponse
import app.textsy.data.remote.TextsyApi
import app.textsy.data.remote.apiCall
import kotlinx.serialization.json.Json

/** Finding people (discovery and search) and blocking them. */
class PeopleRepository(
    private val api: TextsyApi,
    private val json: Json,
) {
    suspend fun discover(tag: String? = null, skip: Int = 0, limit: Int = PAGE_SIZE): UsersResponse =
        apiCall(json) { api.discover(tag = tag?.takeIf { it.isNotBlank() }, limit = limit, skip = skip) }

    suspend fun search(query: String): List<PublicUser> =
        apiCall(json) { api.search(query.trim()) }.users

    suspend fun blocked(): List<PublicUser> = apiCall(json) { api.blocked() }.users

    suspend fun block(handle: String) {
        apiCall(json) { api.block(handle) }
    }

    suspend fun unblock(handle: String) {
        apiCall(json) { api.unblock(handle) }
    }

    companion object {
        const val PAGE_SIZE = 20
    }
}
