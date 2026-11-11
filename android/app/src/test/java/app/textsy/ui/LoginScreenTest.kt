package app.textsy.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.textsy.data.model.AuthResponse
import app.textsy.data.repo.SessionState
import app.textsy.data.httpError
import app.textsy.data.sampleUser
import app.textsy.ui.auth.LoginScreen
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class LoginScreenTest {
    @get:Rule
    val rule = newComposeRule()
    private val deps = TestDeps()
    private var openedRegister = false

    private fun show() = rule.showScreen(deps) { LoginScreen(onRegister = { openedRegister = true }) }

    @Test
    fun `shows the welcome text and the sign in form`() {
        show()
        rule.onNodeWithText("Welcome back").assertIsDisplayed()
        rule.onNodeWithText("Email or handle").assertIsDisplayed()
        rule.onNodeWithText("Password").assertIsDisplayed()
    }

    @Test
    fun `submitting an empty form asks for the details and does not call the server`() {
        show()
        rule.onNodeWithText("Sign in").performClick()
        rule.onNodeWithText("This field is required.").assertIsDisplayed()
        assertTrue(deps.api.loginCalls.isEmpty())
    }

    @Test
    fun `typed details are sent and the person ends up signed in`() {
        deps.api.loginResult = { AuthResponse("jwt-1", sampleUser(handle = "asha")) }
        show()

        rule.onNodeWithText("Email or handle").performTextInput("  asha ")
        rule.onNodeWithText("Password").performTextInput("password1")
        rule.onNodeWithText("Sign in").performClick()

        rule.waitUntil(5_000) { deps.auth.state.value is SessionState.SignedIn }
        assertEquals("asha", deps.api.loginCalls.single().identifier)
        assertEquals("password1", deps.api.loginCalls.single().password)
    }

    @Test
    fun `wrong details show a friendly message and keep the person on the form`() {
        deps.api.loginResult = { throw httpError(401, "Incorrect email/handle or password") }
        show()

        rule.onNodeWithText("Email or handle").performTextInput("asha")
        rule.onNodeWithText("Password").performTextInput("wrongpass")
        rule.onNodeWithText("Sign in").performClick()

        rule.waitUntil(5_000) { rule.hasTextCount("Incorrect email/handle or password.") > 0 }
        assertTrue(deps.auth.state.value !is SessionState.SignedIn)
    }

    @Test
    fun `an unreachable server shows the network message`() {
        deps.api.loginResult = { throw java.io.IOException("no route") }
        show()

        rule.onNodeWithText("Email or handle").performTextInput("asha")
        rule.onNodeWithText("Password").performTextInput("password1")
        rule.onNodeWithText("Sign in").performClick()

        rule.waitUntil(5_000) { rule.hasTextCount("Can't reach Textsy. Check your internet connection and try again.") > 0 }
    }

    @Test
    fun `the create account link opens registration`() {
        show()
        // On a small screen the link is below the fold, so scroll to it like a person would.
        rule.onNodeWithText("Create account").performScrollTo().performClick()
        assertTrue(openedRegister)
    }

    @Test
    @Config(qualifiers = "hi")
    fun `the whole screen is in Hindi when the device language is Hindi`() {
        show()
        rule.onNodeWithText("वापसी पर स्वागत है").assertIsDisplayed()
        rule.onNodeWithText("ईमेल या हैंडल").assertIsDisplayed()
        rule.onNodeWithText("पासवर्ड").assertIsDisplayed()
        rule.onNodeWithText("साइन इन करें").assertIsDisplayed()
    }
}
