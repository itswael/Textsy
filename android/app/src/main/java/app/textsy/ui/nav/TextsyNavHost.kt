package app.textsy.ui.nav

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import app.textsy.ui.auth.LoginScreen
import app.textsy.ui.auth.RegisterScreen
import app.textsy.ui.chats.ChatScreen
import app.textsy.ui.main.MainScreen
import app.textsy.ui.profile.BlockedUsersScreen
import app.textsy.ui.profile.EditProfileScreen

private object Route {
    const val LOGIN = "login"
    const val REGISTER = "register"
    const val MAIN = "main"
    const val CHAT = "chat/{chatId}"
    const val EDIT_PROFILE = "profile/edit"
    const val BLOCKED = "profile/blocked"
    fun chat(id: String) = "chat/$id"
}

/** Screens shown while signed out. */
@Composable
fun AuthNavHost() {
    val nav = rememberNavController()
    NavHost(navController = nav, startDestination = Route.LOGIN) {
        composable(Route.LOGIN) { LoginScreen(onRegister = { nav.navigate(Route.REGISTER) }) }
        composable(Route.REGISTER) { RegisterScreen(onBack = { nav.popBackStack() }) }
    }
}

/** Screens shown while signed in. Signing out replaces this whole graph, so no screen outlives the session. */
@Composable
fun MainNavHost() {
    val nav = rememberNavController()
    NavHost(navController = nav, startDestination = Route.MAIN) {
        composable(Route.MAIN) {
            MainScreen(
                onOpenChat = { nav.navigate(Route.chat(it)) },
                onEditProfile = { nav.navigate(Route.EDIT_PROFILE) },
                onBlockedUsers = { nav.navigate(Route.BLOCKED) },
            )
        }
        composable(Route.CHAT, arguments = listOf(navArgument("chatId") { type = NavType.StringType })) { entry ->
            val chatId = entry.arguments?.getString("chatId")
            if (chatId == null) {
                LaunchedEffect(Unit) { nav.popBackStack() }
            } else {
                ChatScreen(chatId = chatId, onBack = { nav.popBackStack() })
            }
        }
        composable(Route.EDIT_PROFILE) { EditProfileScreen(onDone = { nav.popBackStack() }) }
        composable(Route.BLOCKED) { BlockedUsersScreen(onBack = { nav.popBackStack() }) }
    }
}
