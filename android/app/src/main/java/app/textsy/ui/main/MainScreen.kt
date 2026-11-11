package app.textsy.ui.main

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.textsy.R
import app.textsy.ui.chats.ChatListScreen
import app.textsy.ui.common.LocalContainer
import app.textsy.ui.people.PeopleScreen
import app.textsy.ui.profile.ProfileScreen

private enum class Tab(val label: Int, val icon: ImageVector) {
    CHATS(R.string.tab_chats, Icons.Filled.Email),
    PEOPLE(R.string.tab_people, Icons.Filled.Search),
    PROFILE(R.string.tab_profile, Icons.Filled.Person),
}

@Composable
fun MainScreen(
    onOpenChat: (String) -> Unit,
    onEditProfile: () -> Unit,
    onBlockedUsers: () -> Unit,
) {
    var tab by rememberSaveable { mutableStateOf(Tab.CHATS) }
    val unread by LocalContainer.current.chats.chats
        .collectAsStateWithLifecycle()
        .let { state -> androidx.compose.runtime.derivedStateOf { state.value.sumOf { it.unread } } }

    Scaffold(
        bottomBar = {
            NavigationBar {
                Tab.entries.forEach { entry ->
                    NavigationBarItem(
                        selected = tab == entry,
                        onClick = { tab = entry },
                        label = { Text(stringResource(entry.label)) },
                        icon = {
                            if (entry == Tab.CHATS && unread > 0) {
                                BadgedBox(badge = { Badge { Text(if (unread > 99) "99+" else unread.toString()) } }) {
                                    Icon(entry.icon, contentDescription = null)
                                }
                            } else {
                                Icon(entry.icon, contentDescription = null)
                            }
                        },
                    )
                }
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when (tab) {
                Tab.CHATS -> ChatListScreen(onOpenChat = onOpenChat, onFindPeople = { tab = Tab.PEOPLE })
                Tab.PEOPLE -> PeopleScreen(onOpenChat = onOpenChat)
                Tab.PROFILE -> ProfileScreen(onEditProfile = onEditProfile, onBlockedUsers = onBlockedUsers)
            }
        }
    }
}
