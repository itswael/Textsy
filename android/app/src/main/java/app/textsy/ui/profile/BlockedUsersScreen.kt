package app.textsy.ui.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.textsy.R
import app.textsy.data.model.PublicUser
import app.textsy.data.remote.ApiException
import app.textsy.data.repo.ChatRepository
import app.textsy.data.repo.PeopleRepository
import app.textsy.ui.common.Avatar
import app.textsy.ui.common.CenteredLoading
import app.textsy.ui.common.MessageState
import app.textsy.ui.common.RetryState
import app.textsy.ui.common.appViewModel
import app.textsy.ui.common.userMessage
import kotlinx.coroutines.launch

class BlockedUsersViewModel(
    private val people: PeopleRepository,
    private val chats: ChatRepository,
) : ViewModel() {
    var users by mutableStateOf<List<PublicUser>?>(null)
        private set
    var error by mutableStateOf<ApiException?>(null)
        private set

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            error = null
            try {
                users = people.blocked()
            } catch (e: ApiException) {
                error = e
            }
        }
    }

    fun unblock(user: PublicUser) {
        viewModelScope.launch {
            try {
                people.unblock(user.handle)
                users = users?.filterNot { it.id == user.id }
                chats.refreshChats() // the conversation reappears
            } catch (e: ApiException) {
                error = e
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BlockedUsersScreen(onBack: () -> Unit) {
    val vm = appViewModel { BlockedUsersViewModel(it.people, it.chats) }
    val users = vm.users

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.blocked_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back))
                    }
                },
            )
        },
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            when {
                users == null && vm.error != null -> RetryState(vm.error!!.userMessage(), onRetry = vm::load)
                users == null -> CenteredLoading()
                users.isEmpty() -> MessageState(title = stringResource(R.string.blocked_empty))
                else -> LazyColumn(contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(users, key = { it.id }) { user ->
                        Row(
                            Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Avatar(user.avatar, size = 44.dp)
                            Text(
                                "${user.name}  @${user.handle}",
                                style = MaterialTheme.typography.bodyLarge,
                                modifier = Modifier.weight(1f),
                                maxLines = 1,
                            )
                            OutlinedButton(onClick = { vm.unblock(user) }) { Text(stringResource(R.string.action_unblock)) }
                        }
                    }
                }
            }
        }
    }
}
