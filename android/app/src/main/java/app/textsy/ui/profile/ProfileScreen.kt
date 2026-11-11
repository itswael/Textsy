package app.textsy.ui.profile

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.textsy.R
import app.textsy.data.model.PreferencesPatch
import app.textsy.data.model.UpdateProfileRequest
import app.textsy.data.remote.ApiException
import app.textsy.data.repo.AuthRepository
import app.textsy.data.repo.SessionState
import app.textsy.ui.common.Avatar
import app.textsy.ui.common.ErrorLine
import app.textsy.ui.common.LanguageToggle
import app.textsy.ui.common.LocalContainer
import app.textsy.ui.common.appViewModel
import app.textsy.ui.common.userMessage
import kotlinx.coroutines.launch

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ProfileScreen(onEditProfile: () -> Unit, onBlockedUsers: () -> Unit) {
    val container = LocalContainer.current
    val user = (container.auth.state.collectAsStateWithLifecycle().value as? SessionState.SignedIn)?.user ?: return
    val scope = rememberCoroutineScope()

    var confirmSignOut by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }

    fun update(request: UpdateProfileRequest) {
        scope.launch { try { container.auth.updateProfile(request) } catch (_: ApiException) { /* the switch snaps back to the saved value */ } }
    }

    Column(
        Modifier.fillMaxSize().statusBarsPadding().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Avatar(user.avatar, size = 72.dp)
            Column(Modifier.weight(1f)) {
                Text(user.name, style = MaterialTheme.typography.headlineSmall)
                Text("@${user.handle}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (user.area.isNotBlank() || user.city.isNotBlank()) {
                    Text(
                        listOf(user.area, user.city).filter { it.isNotBlank() }.joinToString(", "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        Text(
            user.bio.ifBlank { stringResource(R.string.profile_no_bio) },
            color = if (user.bio.isBlank()) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
        )

        if (user.interests.isNotEmpty()) {
            Text(stringResource(R.string.profile_interests), style = MaterialTheme.typography.titleSmall)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                user.interests.forEach { AssistChip(onClick = {}, label = { Text(it) }) }
            }
        }

        OutlinedButton(onClick = onEditProfile, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.profile_edit))
        }

        HorizontalDivider()
        Text(stringResource(R.string.language_label), style = MaterialTheme.typography.titleSmall)
        LanguageToggle(onChanged = { code -> update(UpdateProfileRequest(preferences = PreferencesPatch(language = code))) })

        HorizontalDivider()
        Text(stringResource(R.string.profile_privacy), style = MaterialTheme.typography.titleSmall)
        SwitchRow(stringResource(R.string.setting_show_online), user.preferences.showOnlineStatus) {
            update(UpdateProfileRequest(preferences = PreferencesPatch(showOnlineStatus = it)))
        }
        SwitchRow(stringResource(R.string.setting_show_last_seen), user.preferences.showLastSeen) {
            update(UpdateProfileRequest(preferences = PreferencesPatch(showLastSeen = it)))
        }
        TextButton(onClick = onBlockedUsers, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.profile_blocked_users), modifier = Modifier.fillMaxWidth())
        }

        HorizontalDivider()
        OutlinedButton(onClick = { confirmSignOut = true }, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.profile_sign_out))
        }
        TextButton(onClick = { confirmDelete = true }, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.profile_delete_account), color = MaterialTheme.colorScheme.error)
        }
        Spacer(Modifier.height(24.dp))
    }

    if (confirmSignOut) {
        AlertDialog(
            onDismissRequest = { confirmSignOut = false },
            title = { Text(stringResource(R.string.signout_confirm_title)) },
            text = { Text(stringResource(R.string.signout_confirm_body)) },
            confirmButton = {
                TextButton(onClick = { confirmSignOut = false; scope.launch { container.auth.signOut() } }) {
                    Text(stringResource(R.string.profile_sign_out))
                }
            },
            dismissButton = { TextButton(onClick = { confirmSignOut = false }) { Text(stringResource(R.string.common_cancel)) } },
        )
    }

    if (confirmDelete) {
        DeleteAccountDialog(onDismiss = { confirmDelete = false })
    }
}

@Composable
private fun SwitchRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable { onChange(!checked) },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, modifier = Modifier.weight(1f).padding(end = 12.dp))
        Switch(checked = checked, onCheckedChange = onChange)
    }
}

/** State and rules for the delete-account dialog, kept out of the composable so they can be tested on their own. */
class DeleteAccountViewModel(private val auth: AuthRepository) : ViewModel() {
    var password by mutableStateOf("")
        private set
    var busy by mutableStateOf(false)
        private set
    var error by mutableStateOf<ApiException?>(null)
        private set

    val canSubmit: Boolean get() = password.isNotEmpty() && !busy

    fun onPasswordChange(value: String) {
        password = value
        error = null
    }

    /** Forgets what was typed. Called when the dialog is closed so a password never lingers. */
    fun reset() {
        if (busy) return
        password = ""
        error = null
    }

    /** Asks the server to delete the account. On success the session ends and the app returns to sign-in. */
    fun submit() {
        if (!canSubmit) return
        viewModelScope.launch {
            busy = true
            error = null
            try {
                auth.deleteAccount(password)
            } catch (e: ApiException) {
                error = e // a wrong password keeps the person signed in so they can try again
            } finally {
                busy = false
            }
        }
    }
}

@Composable
private fun DeleteAccountDialog(onDismiss: () -> Unit) {
    val vm = appViewModel(key = "delete-account") { DeleteAccountViewModel(it.auth) }
    val dismiss = { vm.reset(); onDismiss() }

    AlertDialog(
        onDismissRequest = { if (!vm.busy) dismiss() },
        title = { Text(stringResource(R.string.delete_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(stringResource(R.string.delete_body))
                OutlinedTextField(
                    value = vm.password,
                    onValueChange = vm::onPasswordChange,
                    label = { Text(stringResource(R.string.field_password)) },
                    singleLine = true,
                    isError = vm.error != null,
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                )
                ErrorLine(vm.error?.userMessage())
            }
        },
        confirmButton = {
            TextButton(enabled = vm.canSubmit, onClick = vm::submit) {
                Text(stringResource(R.string.delete_confirm), color = MaterialTheme.colorScheme.error)
            }
        },
        dismissButton = { TextButton(enabled = !vm.busy, onClick = dismiss) { Text(stringResource(R.string.common_cancel)) } },
    )
}
