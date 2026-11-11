package app.textsy.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Brand = Color(0xFF0A7EA4)

private val LightColors = lightColorScheme(
    primary = Brand,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFCDEBF6),
    onPrimaryContainer = Color(0xFF00313F),
    secondaryContainer = Color(0xFFE3EEF3),
    onSecondaryContainer = Color(0xFF14262E),
    background = Color(0xFFFAFCFD),
    surface = Color(0xFFFAFCFD),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF7BCFEE),
    onPrimary = Color(0xFF003546),
    primaryContainer = Color(0xFF004D65),
    onPrimaryContainer = Color(0xFFCDEBF6),
    secondaryContainer = Color(0xFF2B3A41),
    onSecondaryContainer = Color(0xFFD7E4EA),
    background = Color(0xFF101416),
    surface = Color(0xFF101416),
)

@Composable
fun TextsyTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (darkTheme) DarkColors else LightColors, content = content)
}
