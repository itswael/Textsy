package app.textsy.ui.profile

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.border
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.textsy.R
import app.textsy.data.model.UpdateProfileRequest
import app.textsy.data.remote.ApiException
import app.textsy.data.repo.SessionState
import app.textsy.domain.Validators
import app.textsy.ui.common.ErrorLine
import app.textsy.ui.common.LocalContainer
import app.textsy.ui.common.userMessage
import kotlinx.coroutines.launch

private val AVATARS = listOf("🙂", "😎", "🧑‍💻", "🎨", "🏏", "📚", "🎵", "☕", "🧘", "🍜", "🚴", "📷")

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun EditProfileScreen(onDone: () -> Unit) {
    val container = LocalContainer.current
    val user = (container.auth.state.collectAsStateWithLifecycle().value as? SessionState.SignedIn)?.user ?: return
    val scope = rememberCoroutineScope()

    var name by rememberSaveable { mutableStateOf(user.displayName) }
    var bio by rememberSaveable { mutableStateOf(user.bio) }
    var area by rememberSaveable { mutableStateOf(user.area) }
    var interests by rememberSaveable { mutableStateOf(user.interests.joinToString(", ")) }
    var avatar by rememberSaveable { mutableStateOf(user.avatar) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<ApiException?>(null) }

    val parsed = Validators.parseInterests(interests)
    val interestsError = when (Validators.interestsError(parsed)) {
        Validators.InterestsError.TOO_MANY -> R.string.err_interests_too_many
        Validators.InterestsError.TOO_LONG -> R.string.err_interests_too_long
        null -> null
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.edit_profile_title)) },
                navigationIcon = {
                    IconButton(onClick = onDone) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back))
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).imePadding().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(stringResource(R.string.field_avatar), style = MaterialTheme.typography.titleSmall)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                AVATARS.forEach { emoji ->
                    Box(
                        Modifier
                            .size(48.dp)
                            .border(
                                width = if (emoji == avatar) 2.dp else 1.dp,
                                color = if (emoji == avatar) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
                                shape = CircleShape,
                            )
                            .clickable { avatar = emoji },
                        contentAlignment = Alignment.Center,
                    ) { Text(emoji, fontSize = 24.sp) }
                }
            }

            OutlinedTextField(
                value = name,
                onValueChange = { name = it.take(Validators.MAX_NAME) },
                label = { Text(stringResource(R.string.field_display_name)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = bio,
                onValueChange = { bio = it.take(Validators.MAX_BIO) },
                label = { Text(stringResource(R.string.field_bio)) },
                supportingText = { Text("${bio.length}/${Validators.MAX_BIO}") },
                minLines = 3,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = area,
                onValueChange = { area = it.take(40) },
                label = { Text(stringResource(R.string.field_area, user.city.ifBlank { "—" })) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = interests,
                onValueChange = { interests = it },
                label = { Text(stringResource(R.string.field_interests)) },
                supportingText = { Text(interestsError?.let { stringResource(it) } ?: stringResource(R.string.hint_interests)) },
                isError = interestsError != null,
                modifier = Modifier.fillMaxWidth(),
            )

            ErrorLine(error?.userMessage())

            Button(
                enabled = !saving && interestsError == null,
                onClick = {
                    scope.launch {
                        saving = true
                        error = null
                        try {
                            container.auth.updateProfile(
                                UpdateProfileRequest(
                                    displayName = name.trim(),
                                    bio = bio.trim(),
                                    area = area.trim(),
                                    avatar = avatar,
                                    interests = parsed,
                                )
                            )
                            onDone()
                        } catch (e: ApiException) {
                            error = e
                        } finally {
                            saving = false
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (saving) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                else Text(stringResource(R.string.common_save))
            }
        }
    }
}
