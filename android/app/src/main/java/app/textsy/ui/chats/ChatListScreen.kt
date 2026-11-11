package app.textsy.ui.chats

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Badge
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.textsy.R
import app.textsy.data.model.ChatSummary
import app.textsy.data.repo.LoadState
import app.textsy.data.repo.SessionState
import app.textsy.ui.common.Avatar
import app.textsy.ui.common.LocalContainer
import app.textsy.ui.common.MessageState
import app.textsy.ui.common.RetryState
import app.textsy.ui.common.TimeFormat
import app.textsy.ui.common.CenteredLoading
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatListScreen(onOpenChat: (String) -> Unit, onFindPeople: () -> Unit) {
    val container = LocalContainer.current
    val chats by container.chats.chats.collectAsStateWithLifecycle()
    val loadState by container.chats.chatsState.collectAsStateWithLifecycle()
    val connected by container.chats.connected.collectAsStateWithLifecycle()
    val session by container.auth.state.collectAsStateWithLifecycle()
    val myId = (session as? SessionState.SignedIn)?.user?.id
    val scope = rememberCoroutineScope()
    var refreshing by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { container.chats.refreshChats() }

    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Text(
            stringResource(R.string.chats_title),
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        )
        if (!connected) {
            Surface(color = MaterialTheme.colorScheme.tertiaryContainer, modifier = Modifier.fillMaxWidth()) {
                Text(
                    stringResource(R.string.connection_connecting),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onTertiaryContainer,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                )
            }
        }

        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = {
                scope.launch {
                    refreshing = true
                    container.chats.refreshChats()
                    refreshing = false
                }
            },
            modifier = Modifier.fillMaxSize(),
        ) {
            when {
                chats.isNotEmpty() -> LazyColumn(Modifier.fillMaxSize()) {
                    items(chats, key = { it.id }) { chat ->
                        ChatRow(chat, myId, onClick = { onOpenChat(chat.id) })
                        HorizontalDivider(Modifier.padding(start = 76.dp))
                    }
                }
                loadState is LoadState.Loading -> CenteredLoading()
                loadState is LoadState.Failed -> RetryState(
                    message = stringResource(R.string.chats_load_failed),
                    onRetry = { scope.launch { container.chats.refreshChats() } },
                )
                else -> MessageState(
                    title = stringResource(R.string.chats_empty_title),
                    body = stringResource(R.string.chats_empty_body),
                    actionLabel = stringResource(R.string.chats_find_people),
                    onAction = onFindPeople,
                )
            }
        }
    }
}

@Composable
private fun ChatRow(chat: ChatSummary, myId: String?, onClick: () -> Unit) {
    val yesterday = stringResource(R.string.time_yesterday)
    val last = chat.lastMessage
    val preview = when {
        last == null -> stringResource(R.string.chat_no_messages_yet)
        last.sender == myId -> stringResource(R.string.chat_you_prefix, last.text)
        else -> last.text
    }
    val unreadText = stringResource(R.string.unread_count, chat.unread)
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .semantics { if (chat.unread > 0) stateDescription = unreadText }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box { Avatar(chat.other.avatar, size = 52.dp) }
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    chat.other.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = if (chat.unread > 0) FontWeight.Bold else FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                last?.let {
                    Text(
                        TimeFormat.relative(it.createdAt, yesterday),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    preview,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    fontWeight = if (chat.unread > 0) FontWeight.SemiBold else FontWeight.Normal,
                    modifier = Modifier.weight(1f),
                )
                if (chat.unread > 0) {
                    // The count is announced through the row's state description instead of as a bare number.
                    Badge(containerColor = MaterialTheme.colorScheme.primary, modifier = Modifier.clearAndSetSemantics {}) {
                        Text(if (chat.unread > 99) "99+" else chat.unread.toString())
                    }
                }
            }
        }
    }
}
