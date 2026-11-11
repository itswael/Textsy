package app.textsy.data.remote

import retrofit2.converter.kotlinx.serialization.asConverterFactory
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import kotlinx.serialization.json.Json
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

/**
 * Holds the current session token for the network layer. The token lives in memory
 * (and, encrypted, in the session store); [onRejected] is called when the server says
 * the session is no longer valid.
 */
class SessionHolder {
    @Volatile
    var token: String? = null

    @Volatile
    var onRejected: () -> Unit = {}
}

object Network {
    fun json(): Json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
    }

    fun okHttp(session: SessionHolder, debug: Boolean): OkHttpClient {
        val builder = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .addInterceptor(authInterceptor(session))
        if (debug) {
            builder.addInterceptor(
                HttpLoggingInterceptor().apply {
                    level = HttpLoggingInterceptor.Level.BASIC
                    redactHeader("Authorization")
                }
            )
        }
        return builder.build()
    }

    /** Adds the bearer token, and reports a 401 on a signed-in request so the app can sign out. */
    internal fun authInterceptor(session: SessionHolder) = Interceptor { chain ->
        val token = session.token
        val request = if (token != null) {
            chain.request().newBuilder().header("Authorization", "Bearer $token").build()
        } else {
            chain.request()
        }
        val response = chain.proceed(request)
        if (token != null && response.code == 401) session.onRejected()
        response
    }

    fun api(baseUrl: String, client: OkHttpClient, json: Json): TextsyApi =
        Retrofit.Builder()
            .baseUrl(baseUrl.trimEnd('/') + "/")
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(TextsyApi::class.java)
}
