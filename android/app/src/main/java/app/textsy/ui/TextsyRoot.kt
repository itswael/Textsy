package app.textsy.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.textsy.R
import app.textsy.data.repo.SessionState
import app.textsy.ui.common.AppLanguage
import app.textsy.ui.common.LocalContainer
import app.textsy.ui.nav.AuthNavHost
import app.textsy.ui.nav.MainNavHost

/** Chooses what to show from the session state: a splash while it loads, then login or the app. */
@Composable
fun TextsyRoot() {
    val session = LocalContainer.current.auth.state.collectAsStateWithLifecycle().value

    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        when (session) {
            SessionState.Loading -> Splash()
            SessionState.SignedOut -> AuthNavHost()
            is SessionState.SignedIn -> {
                // The language chosen on another device follows the account.
                LaunchedEffect(session.user.id) { AppLanguage.set(session.user.preferences.language) }
                MainNavHost()
            }
        }
    }
}

@Composable
private fun Splash() {
    Column(
        Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(stringResource(R.string.app_name), style = MaterialTheme.typography.displaySmall, color = MaterialTheme.colorScheme.primary)
        CircularProgressIndicator()
    }
}
