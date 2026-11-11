package app.textsy

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.CompositionLocalProvider
import app.textsy.ui.TextsyRoot
import app.textsy.ui.common.LocalContainer
import app.textsy.ui.theme.TextsyTheme

// AppCompatActivity (not ComponentActivity) so the per-app language switch works on all Android versions.
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val container = (application as TextsyApp).container
        setContent {
            CompositionLocalProvider(LocalContainer provides container) {
                TextsyTheme { TextsyRoot() }
            }
        }
    }
}
