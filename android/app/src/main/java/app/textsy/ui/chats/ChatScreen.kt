package app.textsy.ui.chats

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.textsy.R
import app.textsy.data.model.ChatMessage
import app.textsy.data.model.ChatSummary
import app.textsy.data.model.MessageStatus
import app.textsy.data.remote.ApiException
import app.textsy.data.repo.ChatRepository
import app.textsy.data.repo.ChatThread
import app.textsy.data.repo.PeopleRepository
import app.textsy.domain.Validators
import app.textsy.ui.common.Avatar
import app.textsy.ui.common.CenteredLoading
import app.textsy.ui.common.LocalContainer
import app.textsy.ui.common.MessageState
import app.textsy.ui.common.RetryState
import app.textsy.ui.common.TimeFormat
import app.textsy.ui.common.appViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class ChatViewModel(
    private val chatId: String,
    private val chats: ChatRepository,
    private val people: PeopleRepository,
) : ViewModel() {
    val thread: StateFlow<ChatThread> = chats.threads
        .map { it[chatId] ?: ChatThread() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ChatThread())

    val chat: StateFlow<ChatSummary?> = chats.chats
        .map { list -> list.firstOrNull { it.id == chatId } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    var draft by mutableStateOf("")
        private set
    var blockError by mutableStateOf<ApiException?>(null)
        private set

    private var typing = false
    private var typingJob: Job? = null

    init {
        load()
        // Opened straight from a notification or after a restart, the chat list may not be loaded yet.
        viewModelScope.launch { if (chats.chats.value.none { it.id == chatId }) chats.refreshChats() }
    }

    fun load() {
        viewModelScope.launch { chats.loadThread(chatId) }
    }

    fun loadOlder() {
        viewModelScope.launch { chats.loadOlder(chatId) }
    }

    fun onDraftChange(text: String) {
        draft = text.take(Validators.MAX_MESSAGE)
        if (text.isBlank()) {
            stopTyping()
            return
        }
        if (!typing) {
            typing = true
            chats.setTyping(chatId, true)
        }
        // "Stopped typing" is sent after a pause, so the other person's indicator does not get stuck.
        typingJob?.cancel()
        typingJob = viewModelScope.launch {
            delay(3_000)
            stopTyping()
        }
    }

    fun send() {
        val text = draft.trim()
        if (text.isEmpty()) return
        chats.send(chatId, text)
        draft = ""
        stopTyping()
    }

    fun retry(clientId: String) = chats.retry(chatId, clientId)

    fun block(handle: String, onDone: () -> Unit) {
        viewModelScope.launch {
            try {
                people.block(handle)
                chats.refreshChats()
                onDone()
            } catch (e: ApiException) {
                blockError = e
            }
        }
    }

    private fun stopTyping() {
        typingJob?.cancel()
        if (typing) {
            typing = false
            chats.setTyping(chatId, false)
        }
    }

    override fun onCleared() {
        stopTyping()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(chatId: String, onBack: () -> Unit) {
    val container = LocalContainer.current
    val vm = appViewModel(key = "chat-$chatId") { ChatViewModel(chatId, it.chats, it.people) }
    val thread by vm.thread.collectAsStateWithLifecycle()
    val chat by vm.chat.collectAsStateWithLifecycle()
    val connected by container.chats.connected.collectAsStateWithLifecycle()
    val myId = (container.auth.state.collectAsStateWithLifecycle().value as? app.textsy.data.repo.SessionState.SignedIn)?.user?.id

    // While this screen is visible, messages that arrive are marked read straight away.
    LifecycleResumeEffect(chatId) {
        container.chats.setActiveChat(chatId)
        onPauseOrDispose { container.chats.setActiveChat(null) }
    }

    var menuOpen by remember { mutableStateOf(false) }
    var confirmBlock by remember { mutableStateOf(false) }
    val other = chat?.other

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back))
                    }
                },
                title = {
                    if (other != null) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Avatar(other.avatar, size = 38.dp)
                            Column {
                                Text(other.name, style = MaterialTheme.typography.titleMedium, maxLines = 1)
                                PresenceLine(typing = thread.otherTyping, online = other.isOnline, lastSeen = other.lastSeen)
                            }
                        }
                    }
                },
                actions = {
                    if (other != null) {
                        IconButton(onClick = { menuOpen = true }) {
                            Icon(Icons.Filled.MoreVert, contentDescription = stringResource(R.string.cd_more))
                        }
                        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                            DropdownMenuItem(
                                text = { Text(stringResource(R.string.menu_block_user, other.handle)) },
                                onClick = { menuOpen = false; confirmBlock = true },
                            )
                        }
                    }
                },
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).imePadding()) {
            if (!connected) {
                Surface(color = MaterialTheme.colorScheme.tertiaryContainer, modifier = Modifier.fillMaxWidth()) {
                    Text(
                        stringResource(R.string.connection_connecting),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onTertiaryContainer,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    )
                }
            }

            Box(Modifier.weight(1f).fillMaxWidth()) {
                when {
                    thread.messages.isNotEmpty() -> MessageList(thread, myId, onLoadOlder = vm::loadOlder, onRetry = vm::retry)
                    thread.error != null && !thread.loaded -> RetryState(stringResource(R.string.chat_load_failed), onRetry = vm::load)
                    !thread.loaded -> CenteredLoading()
                    else -> MessageState(
                        title = stringResource(R.string.chat_empty_title),
                        body = other?.let { stringResource(R.string.chat_empty_body, it.handle) },
                    )
                }
            }

            Composer(vm.draft, vm::onDraftChange, vm::send)
        }
    }

    if (confirmBlock && other != null) {
        AlertDialog(
            onDismissRequest = { confirmBlock = false },
            title = { Text(stringResource(R.string.block_title, other.handle)) },
            text = { Text(stringResource(R.string.block_body)) },
            confirmButton = {
                TextButton(onClick = { confirmBlock = false; vm.block(other.handle, onDone = onBack) }) {
                    Text(stringResource(R.string.block_confirm), color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = { confirmBlock = false }) { Text(stringResource(R.string.common_cancel)) } },
        )
    }
}

@Composable
private fun PresenceLine(typing: Boolean, online: Boolean, lastSeen: String?) {
    val yesterday = stringResource(R.string.time_yesterday)
    val text = when {
        typing -> stringResource(R.string.chat_typing)
        online -> stringResource(R.string.chat_online)
        lastSeen != null -> TimeFormat.relative(lastSeen, yesterday).takeIf { it.isNotEmpty() }
            ?.let { stringResource(R.string.chat_last_seen, it) }
        else -> null
    }
    if (text != null) {
        Text(
            text,
            style = MaterialTheme.typography.labelSmall,
            color = if (typing || online) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
        )
    }
}

@Composable
private fun MessageList(
    thread: ChatThread,
    myId: String?,
    onLoadOlder: () -> Unit,
    onRetry: (String) -> Unit,
) {
    val listState = rememberLazyListState()
    // Newest message first, because the list is drawn from the bottom up.
    val newestFirst = remember(thread.messages) { thread.messages.asReversed() }

    val nearTop by remember {
        derivedStateOf {
            val lastVisible = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1
            lastVisible >= listState.layoutInfo.totalItemsCount - 3
        }
    }
    LaunchedEffect(nearTop, thread.hasMore, thread.messages.size) { if (nearTop && thread.hasMore) onLoadOlder() }

    // Follow new messages only if the person is already at the bottom, so reading history is not interrupted.
    val newestId = newestFirst.firstOrNull()?.let { it.clientId ?: it.id }
    LaunchedEffect(newestId) {
        if (listState.firstVisibleItemIndex <= 1) listState.animateScrollToItem(0)
    }

    LazyColumn(
        state = listState,
        reverseLayout = true,
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        items(newestFirst, key = { it.clientId ?: it.id }) { message ->
            val mine = message.sender == myId
            MessageBubble(
                message = message,
                mine = mine,
                seen = mine && message.status == MessageStatus.SENT && thread.otherReadAt?.let { message.createdAt <= it } == true,
                onRetry = { message.clientId?.let(onRetry) },
            )
        }
        if (thread.loadingOlder) {
            item(key = "loading-older") {
                Box(Modifier.fillMaxWidth().padding(8.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(Modifier.padding(4.dp), strokeWidth = 2.dp)
                }
            }
        }
    }
}

@Composable
private fun MessageBubble(message: ChatMessage, mine: Boolean, seen: Boolean, onRetry: () -> Unit) {
    val failed = message.status == MessageStatus.FAILED
    val bubbleColor = when {
        failed -> MaterialTheme.colorScheme.errorContainer
        mine -> MaterialTheme.colorScheme.primaryContainer
        else -> MaterialTheme.colorScheme.secondaryContainer
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start) {
        Column(horizontalAlignment = if (mine) Alignment.End else Alignment.Start) {
            Surface(
                color = bubbleColor,
                shape = RoundedCornerShape(
                    topStart = 16.dp, topEnd = 16.dp,
                    bottomStart = if (mine) 16.dp else 4.dp, bottomEnd = if (mine) 4.dp else 16.dp,
                ),
                modifier = Modifier.widthIn(max = 300.dp).let { if (failed) it.clickable(onClick = onRetry) else it },
            ) {
                Text(message.text, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
            }
            val meta = when (message.status) {
                MessageStatus.SENDING -> stringResource(R.string.message_sending)
                MessageStatus.FAILED -> stringResource(R.string.message_failed)
                MessageStatus.SENT -> TimeFormat.time(message.createdAt) +
                    if (mine) " · " + stringResource(if (seen) R.string.message_seen else R.string.message_sent) else ""
            }
            Text(
                meta,
                style = MaterialTheme.typography.labelSmall,
                color = if (failed) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
            )
        }
    }
}

@Composable
private fun Composer(text: String, onChange: (String) -> Unit, onSend: () -> Unit) {
    Surface(tonalElevation = 2.dp) {
        Row(
            Modifier.fillMaxWidth().navigationBarsPadding().padding(8.dp),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            OutlinedTextField(
                value = text,
                onValueChange = onChange,
                placeholder = { Text(stringResource(R.string.chat_message_hint)) },
                maxLines = 5,
                shape = RoundedCornerShape(24.dp),
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                modifier = Modifier.weight(1f),
            )
            IconButton(
                onClick = onSend,
                enabled = text.isNotBlank(),
                modifier = Modifier
                    .background(
                        if (text.isNotBlank()) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                        RoundedCornerShape(50),
                    ),
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.Send,
                    contentDescription = stringResource(R.string.cd_send),
                    tint = if (text.isNotBlank()) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
