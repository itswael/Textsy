package app.textsy.ui.common

import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.os.LocaleListCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import app.textsy.AppDependencies
import app.textsy.R
import app.textsy.data.remote.ApiException
import java.util.Locale

val LocalContainer = staticCompositionLocalOf<AppDependencies> { error("AppDependencies not provided") }

/** Creates a ViewModel that can reach the app's repositories. */
@Composable
inline fun <reified VM : ViewModel> appViewModel(key: String? = null, crossinline create: (AppDependencies) -> VM): VM {
    val container = LocalContainer.current
    return viewModel(key = key, factory = viewModelFactory { initializer { create(container) } })
}

/** The city the beta runs in. Used only for labels; the server decides what is allowed. */
object AppConfig {
    const val DEFAULT_CITY = "Meerut"
}

object AppLanguage {
    fun current(): String {
        val chosen = AppCompatDelegate.getApplicationLocales()
        val language = if (chosen.isEmpty) Locale.getDefault().language else chosen[0]?.language
        return if (language == "hi") "hi" else "en"
    }

    fun set(code: String) {
        if (code == current()) return
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(code))
    }
}

/** Turns a backend failure into text in the user's language. Known reasons are translated; others fall back to the server text. */
@Composable
fun ApiException.userMessage(): String = when {
    isNetwork -> stringResource(R.string.error_network)
    code == "handle_taken" -> stringResource(R.string.error_handle_taken)
    code == "email_taken" -> stringResource(R.string.error_email_taken)
    code == "invite_required" -> stringResource(R.string.error_invite_required)
    code == "banned" -> stringResource(R.string.error_banned)
    code == "wrong_password" -> stringResource(R.string.error_wrong_password)
    status == 429 -> stringResource(R.string.error_rate_limited)
    status in 400..499 && message.isNotBlank() -> message
    else -> stringResource(R.string.error_generic)
}

@Composable
fun Avatar(emoji: String, modifier: Modifier = Modifier, size: Dp = 48.dp) {
    Surface(
        modifier = modifier.size(size),
        shape = CircleShape,
        color = MaterialTheme.colorScheme.secondaryContainer,
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(text = emoji.ifBlank { "🙂" }, fontSize = (size.value * 0.5f).sp)
        }
    }
}

@Composable
fun CenteredLoading(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
}

@Composable
fun MessageState(
    title: String,
    modifier: Modifier = Modifier,
    body: String? = null,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Column(
        modifier = modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
        if (body != null) {
            Spacer(Modifier.height(8.dp))
            Text(
                body,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
        if (actionLabel != null && onAction != null) {
            Spacer(Modifier.height(16.dp))
            Button(onClick = onAction) { Text(actionLabel) }
        }
    }
}

@Composable
fun RetryState(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(message, textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.error)
        Spacer(Modifier.height(12.dp))
        OutlinedButton(onClick = onRetry) { Text(stringResource(R.string.common_retry)) }
    }
}

/** English / हिन्दी switch. Changing it restarts the screen in the new language. */
@Composable
fun LanguageToggle(modifier: Modifier = Modifier, onChanged: (String) -> Unit = {}) {
    val current = AppLanguage.current()
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        FilterChip(
            selected = current == "en",
            onClick = { AppLanguage.set("en"); onChanged("en") },
            label = { Text(stringResource(R.string.language_english)) },
        )
        FilterChip(
            selected = current == "hi",
            onClick = { AppLanguage.set("hi"); onChanged("hi") },
            label = { Text(stringResource(R.string.language_hindi)) },
        )
    }
}

@Composable
fun ErrorLine(text: String?, modifier: Modifier = Modifier) {
    if (text == null) return
    Text(
        text,
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodySmall,
        modifier = modifier.fillMaxWidth(),
    )
}
