package app.textsy.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ValidatorsTest {
    @Test
    fun `handles follow the server rules`() {
        assertTrue(Validators.isValidHandle("asha_k"))
        assertTrue(Validators.isValidHandle("@Asha.K"))
        assertTrue(Validators.isValidHandle("abc"))
        assertFalse(Validators.isValidHandle("ab"))
        assertFalse(Validators.isValidHandle("a".repeat(21)))
        assertFalse(Validators.isValidHandle("has space"))
        assertFalse(Validators.isValidHandle("bad!"))
        assertEquals("asha_k", Validators.normalizeHandle("  @Asha_K "))
    }

    @Test
    fun `emails need a name, an at sign and a domain`() {
        assertTrue(Validators.isValidEmail("a@b.co"))
        assertTrue(Validators.isValidEmail("  asha@example.com "))
        assertFalse(Validators.isValidEmail("nope"))
        assertFalse(Validators.isValidEmail("a@b"))
        assertFalse(Validators.isValidEmail("a b@c.com"))
    }

    @Test
    fun `passwords need 8 characters and at most 72 bytes`() {
        assertFalse(Validators.isValidPassword("short"))
        assertTrue(Validators.isValidPassword("12345678"))
        assertTrue(Validators.isValidPassword("a".repeat(72)))
        assertFalse(Validators.isValidPassword("a".repeat(73)))
        // Multi-byte characters count by bytes, like bcrypt does: 25 x 3 bytes = 75.
        assertFalse(Validators.isValidPassword("र".repeat(25)))
    }

    @Test
    fun `interests are split, trimmed, lowercased and de-duplicated`() {
        assertEquals(listOf("cricket", "coffee", "music"), Validators.parseInterests("Cricket, coffee ,  MUSIC,, cricket"))
        assertEquals(emptyList<String>(), Validators.parseInterests("  ,  "))
        assertEquals(listOf("a", "b"), Validators.parseInterests("a;b\n"))
    }

    @Test
    fun `interest limits are reported`() {
        assertNull(Validators.interestsError(List(10) { "tag$it" }))
        assertEquals(Validators.InterestsError.TOO_MANY, Validators.interestsError(List(11) { "tag$it" }))
        assertEquals(Validators.InterestsError.TOO_LONG, Validators.interestsError(listOf("x".repeat(21))))
    }
}
