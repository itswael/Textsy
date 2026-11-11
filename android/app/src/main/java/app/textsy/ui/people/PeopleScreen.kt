package app.textsy.ui.people

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.textsy.R
import app.textsy.data.model.PublicUser
import app.textsy.data.remote.ApiException
import app.textsy.data.repo.AuthRepository
import app.textsy.data.repo.ChatRepository
import app.textsy.data.repo.PeopleRepository
import app.textsy.data.repo.SessionState
import app.textsy.ui.common.Avatar
import app.textsy.ui.common.CenteredLoading
import app.textsy.ui.common.LocalContainer
import app.textsy.ui.common.MessageState
import app.textsy.ui.common.RetryState
import app.textsy.ui.common.appViewModel
import app.textsy.ui.common.userMessage
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

data class PeopleState(
    val users: List<PublicUser> = emptyList(),
    val loading: Boolean = true,
    val loadingMore: Boolean = false,
    val hasMore: Boolean = false,
    val error: ApiException? = null,
)

class PeopleViewModel(
    private val people: PeopleRepository,
    private val chats: ChatRepository,
) : ViewModel() {
    var query by mutableStateOf("")
        private set
    var tag by mutableStateOf<String?>(null)
        private set
    var state by mutableStateOf(PeopleState())
        private set
    var openingHandle by mutableStateOf<String?>(null)
        private set

    private var job: Job? = null

    init {
        reload(0)
    }

    fun onQueryChange(value: String) {
        query = value
        reload(350) // wait for a pause in typing before asking the server
    }

    fun onTagChange(value: String?) {
        tag = value
        reload(0)
    }

    fun retry() = reload(0)

    private fun reload(delayMs: Long) {
        job?.cancel()
        job = viewModelScope.launch {
            delay(delayMs)
            state = state.copy(loading = true, error = null)
            try {
                val q = query.trim()
                state = if (q.length >= 2) {
                    // Search ignores the interest filter: the person asked for something specific.
                    PeopleState(users = people.search(q), loading = false)
                } else {
                    val page = people.discover(tag = tag)
                    PeopleState(users = page.users, hasMore = page.hasMore, loading = false)
                }
            } catch (e: ApiException) {
                state = state.copy(loading = false, error = e)
            }
        }
    }

    fun loadMore() {
        val current = state
        if (!current.hasMore || current.loadingMore || current.loading || query.trim().length >= 2) return
        viewModelScope.launch {
            state = state.copy(loadingMore = true)
            try {
                val page = people.discover(tag = tag, skip = current.users.size)
                state = state.copy(users = current.users + page.users, hasMore = page.hasMore, loadingMore = false)
            } catch (e: ApiException) {
                state = state.copy(loadingMore = false)
            }
        }
    }

    /** Opens (or creates) the conversation. [onResult] gets the chat id, or the error. */
    fun sayHi(user: PublicUser, onResult: (Result<String>) -> Unit) {
        if (openingHandle != null) return
        viewModelScope.launch {
            openingHandle = user.handle
            val result = try {
                Result.success(chats.openChat(user.handle))
            } catch (e: ApiException) {
                Result.failure(e)
            }
            openingHandle = null
            onResult(result)
        }
    }
}

@Composable
fun PeopleScreen(onOpenChat: (String) -> Unit) {
    val container = LocalContainer.current
    val vm = appViewModel { PeopleViewModel(it.people, it.chats) }
    val me = (container.auth.state.collectAsStateWithLifecycle().value as? SessionState.SignedIn)?.user
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val openFailed = stringResource(R.string.people_open_failed)
    val state = vm.state

    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
            Text(stringResource(R.string.people_title), style = MaterialTheme.typography.headlineSmall)
            if (me != null && me.city.isNotBlank()) {
                Text(
                    stringResource(R.string.people_subtitle, me.city),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        OutlinedTextField(
            value = vm.query,
            onValueChange = vm::onQueryChange,
            placeholder = { Text(stringResource(R.string.people_search_hint)) },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = stringResource(R.string.cd_search)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        )

        if (me != null && me.interests.isNotEmpty() && vm.query.trim().length < 2) {
            LazyRow(
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                item {
                    FilterChip(
                        selected = vm.tag == null,
                        onClick = { vm.onTagChange(null) },
                        label = { Text(stringResource(R.string.people_filter_all)) },
                    )
                }
                items(me.interests) { interest ->
                    FilterChip(
                        selected = vm.tag == interest,
                        onClick = { vm.onTagChange(if (vm.tag == interest) null else interest) },
                        label = { Text(interest) },
                    )
                }
            }
        }

        Column(Modifier.weight(1f)) {
            when {
                state.users.isNotEmpty() -> LazyColumn(
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(state.users, key = { it.id }) { user ->
                        PersonCard(
                            user = user,
                            opening = vm.openingHandle == user.handle,
                            onSayHi = {
                                vm.sayHi(user) { result ->
                                    result.onSuccess(onOpenChat)
                                    result.onFailure { scope.launch { snackbar.showSnackbar(openFailed) } }
                                }
                            },
                        )
                    }
                    if (state.hasMore) {
                        item {
                            OutlinedButton(
                                onClick = vm::loadMore,
                                enabled = !state.loadingMore,
                                modifier = Modifier.fillMaxWidth(),
                            ) { Text(stringResource(R.string.people_load_more)) }
                        }
                    }
                }
                state.loading -> CenteredLoading()
                state.error != null -> RetryState(
                    message = state.error.userMessage().ifBlank { stringResource(R.string.people_load_failed) },
                    onRetry = vm::retry,
                )
                else -> MessageState(
                    title = stringResource(R.string.people_empty_title),
                    body = stringResource(R.string.people_empty_body),
                )
            }
        }
        SnackbarHost(snackbar)
    }
}

@Composable
private fun PersonCard(user: PublicUser, opening: Boolean, onSayHi: () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Avatar(user.avatar, size = 52.dp)
                Column(Modifier.weight(1f)) {
                    Text(user.name, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(
                        "@${user.handle}" + if (user.area.isNotBlank()) " · ${user.area}" else "",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                if (user.isOnline) {
                    Text(stringResource(R.string.chat_online), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                }
            }
            if (user.bio.isNotBlank()) {
                Text(user.bio, style = MaterialTheme.typography.bodyMedium, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }
            if (user.sharedInterests.isNotEmpty()) {
                Text(
                    stringResource(R.string.people_shared_interests, user.sharedInterests.joinToString(", ")),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
            } else if (user.interests.isNotEmpty()) {
                Text(
                    user.interests.joinToString(" · "),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Button(onClick = onSayHi, enabled = !opening, modifier = Modifier.align(Alignment.End)) {
                Text(stringResource(R.string.people_say_hi))
            }
        }
    }
}
