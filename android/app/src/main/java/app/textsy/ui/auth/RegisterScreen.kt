package app.textsy.ui.auth

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.textsy.R
import app.textsy.data.model.RegisterRequest
import app.textsy.data.remote.ApiException
import app.textsy.data.repo.AuthRepository
import app.textsy.domain.Validators
import app.textsy.ui.common.AppConfig
import app.textsy.ui.common.AppLanguage
import app.textsy.ui.common.ErrorLine
import app.textsy.ui.common.LanguageToggle
import app.textsy.ui.common.appViewModel
import app.textsy.ui.common.userMessage
import kotlinx.coroutines.launch

/** Everything typed on the sign-up form. */
data class RegisterForm(
    val handle: String = "",
    val email: String = "",
    val password: String = "",
    val displayName: String = "",
    val inviteCode: String = "",
    val area: String = "",
    val interests: String = "",
    val ageConfirmed: Boolean = false,
)

enum class RegisterField { HANDLE, EMAIL, PASSWORD, INTERESTS, AGE }

class RegisterViewModel(private val auth: AuthRepository) : ViewModel() {
    var loading by mutableStateOf(false)
        private set
    var serverError by mutableStateOf<ApiException?>(null)
        private set
    var fieldErrors by mutableStateOf<Map<RegisterField, Int>>(emptyMap())
        private set

    /** Checks the form like the server will, so mistakes are caught before a round trip. */
    fun validate(form: RegisterForm): Map<RegisterField, Int> = buildMap {
        if (!Validators.isValidHandle(form.handle)) put(RegisterField.HANDLE, R.string.err_handle_invalid)
        if (!Validators.isValidEmail(form.email)) put(RegisterField.EMAIL, R.string.err_email_invalid)
        if (!Validators.isValidPassword(form.password)) put(RegisterField.PASSWORD, R.string.err_password_short)
        when (Validators.interestsError(Validators.parseInterests(form.interests))) {
            Validators.InterestsError.TOO_MANY -> put(RegisterField.INTERESTS, R.string.err_interests_too_many)
            Validators.InterestsError.TOO_LONG -> put(RegisterField.INTERESTS, R.string.err_interests_too_long)
            null -> Unit
        }
        if (!form.ageConfirmed) put(RegisterField.AGE, R.string.err_age_required)
    }

    fun submit(form: RegisterForm) {
        if (loading) return
        fieldErrors = validate(form)
        if (fieldErrors.isNotEmpty()) return

        viewModelScope.launch {
            loading = true
            serverError = null
            try {
                auth.register(
                    RegisterRequest(
                        email = form.email.trim(),
                        handle = Validators.normalizeHandle(form.handle),
                        password = form.password,
                        ageConfirmed = true,
                        displayName = form.displayName.trim().takeIf { it.isNotEmpty() },
                        inviteCode = form.inviteCode.trim().takeIf { it.isNotEmpty() },
                        area = form.area.trim().takeIf { it.isNotEmpty() },
                        interests = Validators.parseInterests(form.interests),
                        language = AppLanguage.current(),
                    )
                )
            } catch (e: ApiException) {
                serverError = e
            } finally {
                loading = false
            }
        }
    }
}

@Composable
fun RegisterScreen(onBack: () -> Unit) {
    val vm = appViewModel { RegisterViewModel(it.auth) }
    var form by rememberSaveable(stateSaver = RegisterFormSaver) { mutableStateOf(RegisterForm()) }
    val focus = LocalFocusManager.current
    val next = KeyboardActions(onNext = { focus.moveFocus(FocusDirection.Down) })

    @Composable
    fun field(
        value: String,
        onChange: (String) -> Unit,
        label: String,
        error: Int? = null,
        supporting: String? = null,
        keyboard: KeyboardType = KeyboardType.Text,
        password: Boolean = false,
        last: Boolean = false,
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = onChange,
            label = { Text(label) },
            singleLine = true,
            isError = error != null,
            supportingText = { Text(error?.let { stringResource(it) } ?: supporting.orEmpty()) },
            visualTransformation = if (password) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
            keyboardOptions = KeyboardOptions(keyboardType = keyboard, imeAction = if (last) ImeAction.Done else ImeAction.Next),
            keyboardActions = if (last) KeyboardActions(onDone = { focus.clearFocus() }) else next,
            modifier = Modifier.fillMaxWidth(),
        )
    }

    Surface(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .safeDrawingPadding()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back))
                }
                LanguageToggle()
            }
            Text(stringResource(R.string.register_title), style = MaterialTheme.typography.headlineSmall)
            Text(
                stringResource(R.string.register_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(12.dp))

            field(form.handle, { form = form.copy(handle = it) }, stringResource(R.string.field_handle),
                vm.fieldErrors[RegisterField.HANDLE], stringResource(R.string.hint_handle))
            field(form.email, { form = form.copy(email = it) }, stringResource(R.string.field_email),
                vm.fieldErrors[RegisterField.EMAIL], keyboard = KeyboardType.Email)
            field(form.password, { form = form.copy(password = it) }, stringResource(R.string.field_password),
                vm.fieldErrors[RegisterField.PASSWORD], stringResource(R.string.hint_password),
                keyboard = KeyboardType.Password, password = true)
            field(form.displayName, { form = form.copy(displayName = it) }, stringResource(R.string.field_display_name))
            field(form.inviteCode, { form = form.copy(inviteCode = it) }, stringResource(R.string.field_invite_code))
            field(form.area, { form = form.copy(area = it) }, stringResource(R.string.field_area, AppConfig.DEFAULT_CITY))
            field(form.interests, { form = form.copy(interests = it) }, stringResource(R.string.field_interests),
                vm.fieldErrors[RegisterField.INTERESTS], stringResource(R.string.hint_interests), last = true)

            Row(
                Modifier.fillMaxWidth().clickable { form = form.copy(ageConfirmed = !form.ageConfirmed) },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(checked = form.ageConfirmed, onCheckedChange = { form = form.copy(ageConfirmed = it) })
                Text(stringResource(R.string.register_age_confirm))
            }
            vm.fieldErrors[RegisterField.AGE]?.let { ErrorLine(stringResource(it)) }
            vm.serverError?.let { ErrorLine(it.userMessage()) }

            Spacer(Modifier.height(8.dp))
            Button(
                onClick = { focus.clearFocus(); vm.submit(form) },
                enabled = !vm.loading,
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) {
                if (vm.loading) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
                else Text(stringResource(R.string.action_create_account))
            }
            TextButton(onClick = onBack, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.register_have_account))
            }
        }
    }
}

/** Keeps the half-filled form across rotation and process death. The password is deliberately not saved. */
private val RegisterFormSaver = androidx.compose.runtime.saveable.listSaver<RegisterForm, Any>(
    save = { listOf(it.handle, it.email, it.displayName, it.inviteCode, it.area, it.interests, it.ageConfirmed) },
    restore = {
        RegisterForm(
            handle = it[0] as String, email = it[1] as String, displayName = it[2] as String,
            inviteCode = it[3] as String, area = it[4] as String, interests = it[5] as String,
            ageConfirmed = it[6] as Boolean,
        )
    },
)
