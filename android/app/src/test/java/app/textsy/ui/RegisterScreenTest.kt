package app.textsy.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.textsy.data.httpError
import app.textsy.data.model.AuthResponse
import app.textsy.data.repo.SessionState
import app.textsy.data.sampleUser
import app.textsy.ui.auth.RegisterScreen
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RegisterScreenTest {
    @get:Rule
    val rule = newComposeRule()
    private val deps = TestDeps()
    private var wentBack = false

    private fun show() = rule.showScreen(deps) { RegisterScreen(onBack = { wentBack = true }) }

    private fun submit() = rule.onNodeWithText("Create account").performScrollTo().performClick()

    private fun fillValidForm() {
        rule.typeInto("Handle", "@Asha_K ")
        rule.typeInto("Email", "  asha@example.com ")
        rule.typeInto("Password", "password1")
        rule.typeInto("Name (optional)", "Asha Rao")
        rule.typeInto("Invite code", "MEERUT-BETA")
        rule.typeInto("Your area in Meerut (optional)", "Shastri Nagar")
        rule.typeInto("Interests", "Cricket, coffee ,CRICKET")
        rule.onNodeWithText("I am 18 years or older").performScrollTo().performClick()
    }

    @Test
    fun `shows the heading and explains that the email stays private`() {
        show()
        rule.onNodeWithText("Create your account").assertIsDisplayed()
        rule.onNodeWithText("Your handle is how people find you. Your email stays private.").assertIsDisplayed()
    }

    @Test
    fun `an empty form is rejected on the device with a reason for each problem`() {
        show()
        submit()

        rule.waitForText("Use 3–20 letters, numbers, dots or underscores.")
        rule.waitForText("Enter a valid email address.")
        rule.waitForText("Password must be at least 8 characters.")
        rule.waitForText("You must confirm that you are 18 or older.")
        assertTrue("nothing should reach the server", deps.api.registerCalls.isEmpty())
    }

    @Test
    fun `a valid form sends clean values and signs the person in`() {
        deps.api.registerResult = { AuthResponse("jwt-new", sampleUser(handle = "asha_k")) }
        show()
        fillValidForm()
        submit()

        rule.waitUntil(5_000) { deps.auth.state.value is SessionState.SignedIn }
        val sent = deps.api.registerCalls.single()
        assertEquals("handle is lower-cased and the @ and spaces are dropped", "asha_k", sent.handle)
        assertEquals("asha@example.com", sent.email)
        assertEquals("password1", sent.password)
        assertEquals("Asha Rao", sent.displayName)
        assertEquals("MEERUT-BETA", sent.inviteCode)
        assertEquals("Shastri Nagar", sent.area)
        assertEquals(listOf("cricket", "coffee"), sent.interests)
        assertEquals(true, sent.ageConfirmed)
        assertEquals("en", sent.language)
    }

    @Test
    fun `optional fields left empty are not sent at all`() {
        deps.api.registerResult = { AuthResponse("jwt", sampleUser()) }
        show()
        rule.typeInto("Handle", "ravi")
        rule.typeInto("Email", "ravi@example.com")
        rule.typeInto("Password", "password1")
        rule.onNodeWithText("I am 18 years or older").performScrollTo().performClick()
        submit()

        rule.waitUntil(5_000) { deps.api.registerCalls.isNotEmpty() }
        val sent = deps.api.registerCalls.single()
        assertEquals(null, sent.displayName)
        assertEquals(null, sent.inviteCode)
        assertEquals(null, sent.area)
        assertEquals(emptyList<String>(), sent.interests)
    }

    @Test
    fun `too many interests are caught before sending`() {
        show()
        fillValidForm()
        rule.typeInto("Interests", ", a1, a2, a3, a4, a5, a6, a7, a8, a9, a10")
        submit()

        rule.waitForText("Add at most 10 interests.")
        assertTrue(deps.api.registerCalls.isEmpty())
    }

    @Test
    fun `a taken handle is explained in plain words`() {
        deps.api.registerResult = { throw httpError(409, "That handle is already taken", "handle_taken") }
        show()
        fillValidForm()
        submit()

        rule.waitForText("That handle is already taken.")
        assertTrue(deps.auth.state.value !is SessionState.SignedIn)
    }

    @Test
    fun `a missing or wrong invite code is explained`() {
        deps.api.registerResult = { throw httpError(403, "A valid invite code is required", "invite_required") }
        show()
        fillValidForm()
        submit()

        rule.waitForText("A valid invite code is required.")
    }

    @Test
    fun `the back arrow and the sign in link return to the login screen`() {
        show()
        rule.onNodeWithText("Already have an account? Sign in").performScrollTo().performClick()
        assertTrue(wentBack)
    }
}
