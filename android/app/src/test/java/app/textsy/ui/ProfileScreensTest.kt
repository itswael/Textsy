package app.textsy.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.textsy.data.model.Preferences
import app.textsy.data.model.SelfUserResponse
import app.textsy.data.model.UsersResponse
import app.textsy.data.repo.SessionState
import app.textsy.data.sampleUser
import app.textsy.ui.profile.BlockedUsersScreen
import app.textsy.ui.profile.EditProfileScreen
import app.textsy.ui.profile.ProfileScreen
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ProfileScreensTest {
    @get:Rule
    val rule = newComposeRule()

    private val me = sampleUser(id = "me", handle = "asha", name = "Asha Rao", interests = listOf("cricket", "chess"))
        .copy(bio = "Weekend batsman and chess hobbyist.")
    private val deps = TestDeps().signedIn(me)
    private var editOpened = false
    private var blockedOpened = false

    private fun showProfile() = rule.showScreen(deps) {
        ProfileScreen(onEditProfile = { editOpened = true }, onBlockedUsers = { blockedOpened = true })
    }

    // ---- Profile ----

    @Test
    fun `shows my details`() {
        showProfile()
        rule.onNodeWithText("Asha Rao").assertIsDisplayed()
        rule.onNodeWithText("@asha").assertIsDisplayed()
        rule.onNodeWithText("Shastri Nagar, Meerut").assertIsDisplayed()
        rule.onNodeWithText("Weekend batsman and chess hobbyist.").assertIsDisplayed()
        rule.onNodeWithText("cricket").assertIsDisplayed()
        rule.onNodeWithText("chess").assertIsDisplayed()
    }

    @Test
    fun `a profile without a bio prompts for one`() {
        val bare = sampleUser(id = "me2", handle = "bare")
        val local = TestDeps().signedIn(bare)
        rule.showScreen(local) { ProfileScreen(onEditProfile = {}, onBlockedUsers = {}) }
        rule.onNodeWithText("Add a short bio so people know who you are.").assertIsDisplayed()
    }

    @Test
    fun `the edit and blocked users buttons navigate`() {
        showProfile()
        rule.onNodeWithText("Edit profile").performScrollTo().performClick()
        rule.onNodeWithText("Blocked users").performScrollTo().performClick()
        assertTrue(editOpened)
        assertTrue(blockedOpened)
    }

    @Test
    fun `privacy switches save to the server and the screen follows the saved value`() {
        deps.api.updateMeResult = { req ->
            SelfUserResponse(me.copy(preferences = Preferences(showOnlineStatus = req.preferences?.showOnlineStatus ?: true)))
        }
        showProfile()

        rule.onNodeWithText("Show when I'm online").performScrollTo().performClick()

        rule.waitUntil(5_000) { deps.api.updateCalls.isNotEmpty() }
        assertEquals(false, deps.api.updateCalls.single().preferences?.showOnlineStatus)
        rule.waitUntil(5_000) { (deps.auth.state.value as SessionState.SignedIn).user.preferences.showOnlineStatus.not() }
    }

    @Test
    fun `a failed privacy change leaves the setting as it was`() {
        deps.api.updateMeResult = { throw java.io.IOException("offline") }
        showProfile()

        rule.onNodeWithText("Show when I'm online").performScrollTo().performClick()

        rule.waitUntil(5_000) { deps.api.updateCalls.isNotEmpty() }
        assertTrue((deps.auth.state.value as SessionState.SignedIn).user.preferences.showOnlineStatus)
    }

    @Test
    fun `choosing a language is saved to the account`() {
        deps.api.updateMeResult = { SelfUserResponse(me) }
        showProfile()

        rule.onNodeWithText("हिन्दी").performScrollTo().performClick()

        rule.waitUntil(5_000) { deps.api.updateCalls.isNotEmpty() }
        assertEquals("hi", deps.api.updateCalls.single().preferences?.language)
    }

    @Test
    fun `signing out asks first and then forgets the session`() {
        showProfile()
        rule.onNodeWithText("Sign out").performScrollTo().performClick()
        rule.onNodeWithText("Sign out?").assertIsDisplayed()
        assertTrue("still signed in until confirmed", deps.auth.state.value is SessionState.SignedIn)

        // The dialog's confirm button has the same label as the button that opened it.
        rule.onAllNodesWithText("Sign out").onLast().performClick()

        rule.waitUntil(5_000) { deps.auth.state.value == SessionState.SignedOut }
        assertNull(deps.store.saved)
    }

    @Test
    fun `cancelling sign out keeps the person signed in`() {
        showProfile()
        rule.onNodeWithText("Sign out").performScrollTo().performClick()
        rule.onNodeWithText("Cancel").performClick()
        rule.waitForNoText("Sign out?")
        assertTrue(deps.auth.state.value is SessionState.SignedIn)
    }

    // The delete-account dialog has no UI test here: Robolectric never goes idle once an AlertDialog
    // containing a text field is shown (a bare Material AlertDialog + TextField does the same). Its
    // rules (password required, wrong password keeps you signed in, no double submit, reset on close)
    // are covered by DeleteAccountViewModelTest instead.

    // ---- Edit profile ----

    @Test
    fun `edit form starts with my current details`() {
        var done = false
        rule.showScreen(deps) { EditProfileScreen(onDone = { done = true }) }
        rule.onNodeWithText("Asha Rao").assertIsDisplayed()
        rule.onNodeWithText("Weekend batsman and chess hobbyist.").assertIsDisplayed()
        rule.onNodeWithText("cricket, chess").assertIsDisplayed()
        assertTrue(!done)
    }

    @Test
    fun `saving sends only clean values and then closes`() {
        var done = false
        deps.api.updateMeResult = { SelfUserResponse(me.copy(bio = "New bio")) }
        rule.showScreen(deps) { EditProfileScreen(onDone = { done = true }) }

        rule.onNodeWithText("Weekend batsman and chess hobbyist.").performTextReplacement("  New bio ")
        rule.onNodeWithText("cricket, chess").performTextReplacement("Music, music ,  Art")
        rule.onNodeWithText("Save").performScrollTo().performClick()

        rule.waitUntil(5_000) { done }
        val sent = deps.api.updateCalls.single()
        assertEquals("New bio", sent.bio)
        assertEquals(listOf("music", "art"), sent.interests)
        assertEquals("Asha Rao", sent.displayName)
    }

    @Test
    fun `too many interests disable saving with an explanation`() {
        rule.showScreen(deps) { EditProfileScreen(onDone = {}) }
        rule.onNodeWithText("cricket, chess").performTextReplacement((1..11).joinToString(",") { "tag$it" })

        rule.waitForText("Add at most 10 interests.")
        rule.onNodeWithText("Save").performScrollTo().assertIsNotEnabled()
        assertTrue(deps.api.updateCalls.isEmpty())
    }

    @Test
    fun `a server error while saving is shown and the form stays open`() {
        var done = false
        deps.api.updateMeResult = { throw java.io.IOException("offline") }
        rule.showScreen(deps) { EditProfileScreen(onDone = { done = true }) }

        rule.onNodeWithText("Save").performScrollTo().performClick()

        rule.waitForText("Can't reach Textsy. Check your internet connection and try again.")
        assertTrue(!done)
        rule.onNodeWithText("Save").performScrollTo().assertIsEnabled()
    }

    // ---- Blocked users ----

    @Test
    fun `blocked users can be unblocked`() {
        val blocked = publicUser("u-x", "spammer", "Spam Bot")
        deps.api.blockedResult = { UsersResponse(listOf(blocked)) }
        rule.showScreen(deps) { BlockedUsersScreen(onBack = {}) }
        rule.waitForText("Spam Bot", substring = true)

        rule.onNodeWithText("Unblock").performClick()

        rule.waitUntil(5_000) { deps.api.unblockCalls.isNotEmpty() }
        assertEquals(listOf("spammer"), deps.api.unblockCalls)
        rule.waitForText("You haven't blocked anyone.")
    }

    @Test
    fun `an empty block list says so`() {
        rule.showScreen(deps) { BlockedUsersScreen(onBack = {}) }
        rule.waitForText("You haven't blocked anyone.")
    }
}
