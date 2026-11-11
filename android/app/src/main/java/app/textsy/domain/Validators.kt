package app.textsy.domain

/**
 * Client-side form checks that mirror the backend's rules, so people get instant feedback.
 * The server remains the authority and re-checks everything.
 */
object Validators {
    private val HANDLE = Regex("^[a-z0-9_.]{3,20}$")
    private val EMAIL = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$")
    const val MAX_INTERESTS = 10
    const val MAX_INTEREST_LENGTH = 20
    const val MIN_PASSWORD = 8
    const val MAX_BIO = 160
    const val MAX_NAME = 50
    const val MAX_MESSAGE = 1000

    fun normalizeHandle(input: String): String = input.trim().removePrefix("@").lowercase()

    fun isValidHandle(input: String): Boolean = HANDLE.matches(normalizeHandle(input))

    fun isValidEmail(input: String): Boolean = input.trim().length <= 254 && EMAIL.matches(input.trim())

    fun isValidPassword(input: String): Boolean =
        input.length >= MIN_PASSWORD && input.toByteArray(Charsets.UTF_8).size <= 72

    /** Splits "Cricket, coffee  music" into clean, unique, lowercase interests. */
    fun parseInterests(input: String): List<String> =
        input.split(',', ';', '\n')
            .map { it.trim().lowercase() }
            .filter { it.isNotEmpty() }
            .distinct()

    fun interestsError(interests: List<String>): InterestsError? = when {
        interests.size > MAX_INTERESTS -> InterestsError.TOO_MANY
        interests.any { it.length > MAX_INTEREST_LENGTH } -> InterestsError.TOO_LONG
        else -> null
    }

    enum class InterestsError { TOO_MANY, TOO_LONG }
}
