package app.textsy.ui

import app.textsy.data.FakeApi
import app.textsy.data.FakeSessionStore
import app.textsy.data.httpError
import app.textsy.data.model.AuthResponse
import app.textsy.data.model.OkResponse
import app.textsy.data.remote.Network
import app.textsy.data.remote.SessionHolder
import app.textsy.data.repo.AuthRepository
import app.textsy.data.repo.SessionState
import app.textsy.data.sampleUser
import app.textsy.ui.profile.DeleteAccountViewModel
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class DeleteAccountViewModelTest {
    private val api = FakeApi()
    private val store = FakeSessionStore()
    private val auth = AuthRepository(api, store, Network.json(), SessionHolder())
    private lateinit var vm: DeleteAccountViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        api.loginResult = { AuthResponse("jwt", sampleUser()) }
        runBlocking { auth.login("asha", "password1") }
        vm = DeleteAccountViewModel(auth)
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `nothing can be submitted until a password is typed`() {
        assertFalse(vm.canSubmit)
        vm.submit()
        assertTrue(api.deleteCalls.isEmpty())

        vm.onPasswordChange("x")
        assertTrue(vm.canSubmit)
    }

    @Test
    fun `a wrong password shows an error, keeps the person signed in and lets them try again`() {
        api.deleteResult = { throw httpError(403, "Incorrect password", "wrong_password") }
        vm.onPasswordChange("wrong")

        vm.submit()

        assertEquals("wrong_password", vm.error?.code)
        assertEquals(403, vm.error?.status)
        assertFalse(vm.busy)
        assertTrue("a typo must not sign the person out", auth.state.value is SessionState.SignedIn)
        assertNotNull(store.saved)
        assertEquals("what they typed is kept so they can fix it", "wrong", vm.password)

        api.deleteResult = { OkResponse() }
        vm.onPasswordChange("password1")
        assertNull("typing clears the old error", vm.error)
        vm.submit()

        assertEquals(SessionState.SignedOut, auth.state.value)
        assertNull(store.saved)
        assertEquals(listOf("wrong", "password1"), api.deleteCalls.map { it.password })
    }

    @Test
    fun `a network failure is reported without signing out`() {
        api.deleteResult = { throw java.io.IOException("offline") }
        vm.onPasswordChange("password1")

        vm.submit()

        assertTrue(vm.error!!.isNetwork)
        assertTrue(auth.state.value is SessionState.SignedIn)
    }

    @Test
    fun `tapping delete twice sends one request`() {
        val gate = CompletableDeferred<Unit>()
        api.deleteResult = { runBlocking { gate.await() }; OkResponse() }
        vm.onPasswordChange("password1")

        // The first request is still in flight (the fake blocks); a second tap must be ignored.
        val first = Thread { vm.submit() }.also { it.start() }
        while (!vm.busy && first.isAlive) Thread.sleep(5)
        vm.submit()
        gate.complete(Unit)
        first.join(5_000)

        assertEquals(1, api.deleteCalls.size)
    }

    @Test
    fun `closing the dialog forgets the password and any error`() {
        api.deleteResult = { throw httpError(403, "Incorrect password", "wrong_password") }
        vm.onPasswordChange("secret")
        vm.submit()
        assertEquals("secret", vm.password)

        vm.reset()

        assertEquals("", vm.password)
        assertNull(vm.error)
        assertFalse(vm.canSubmit)
    }

    private fun assertNotNull(value: Any?) = org.junit.Assert.assertNotNull(value)
}
