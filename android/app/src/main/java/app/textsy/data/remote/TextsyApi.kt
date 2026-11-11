package app.textsy.data.remote

import app.textsy.data.model.AuthResponse
import app.textsy.data.model.ChatResponse
import app.textsy.data.model.ChatsResponse
import app.textsy.data.model.LoginRequest
import app.textsy.data.model.MessagesResponse
import app.textsy.data.model.OkResponse
import app.textsy.data.model.OpenChatRequest
import app.textsy.data.model.PasswordRequest
import app.textsy.data.model.PublicUserResponse
import app.textsy.data.model.RegisterRequest
import app.textsy.data.model.SelfUserResponse
import app.textsy.data.model.UpdateProfileRequest
import app.textsy.data.model.UsersResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.HTTP
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/** The backend's REST API (see docs/SPEC.md, section 8). Paths are relative to the base URL. */
interface TextsyApi {
    @POST("api/auth/register")
    suspend fun register(@Body body: RegisterRequest): AuthResponse

    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): AuthResponse

    @GET("api/auth/me")
    suspend fun me(): SelfUserResponse

    @HTTP(method = "DELETE", path = "api/auth/me", hasBody = true)
    suspend fun deleteAccount(@Body body: PasswordRequest): OkResponse

    @PUT("api/users/me")
    suspend fun updateMe(@Body body: UpdateProfileRequest): SelfUserResponse

    @GET("api/users/discover")
    suspend fun discover(
        @Query("tag") tag: String? = null,
        @Query("area") area: String? = null,
        @Query("limit") limit: Int = 20,
        @Query("skip") skip: Int = 0,
    ): UsersResponse

    @GET("api/users/search")
    suspend fun search(@Query("q") query: String): UsersResponse

    @GET("api/users/blocked")
    suspend fun blocked(): UsersResponse

    @GET("api/users/{handle}")
    suspend fun profile(@Path("handle") handle: String): PublicUserResponse

    @POST("api/users/{handle}/block")
    suspend fun block(@Path("handle") handle: String): OkResponse

    @DELETE("api/users/{handle}/block")
    suspend fun unblock(@Path("handle") handle: String): OkResponse

    @GET("api/chats")
    suspend fun chats(): ChatsResponse

    @POST("api/chats")
    suspend fun openChat(@Body body: OpenChatRequest): ChatResponse

    @GET("api/chats/{id}/messages")
    suspend fun messages(
        @Path("id") chatId: String,
        @Query("before") before: String? = null,
        @Query("limit") limit: Int = 30,
    ): MessagesResponse

    @POST("api/chats/{id}/read")
    suspend fun markRead(@Path("id") chatId: String): OkResponse
}
