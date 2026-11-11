package app.textsy

import app.textsy.data.repo.AuthRepository
import app.textsy.data.repo.ChatRepository
import app.textsy.data.repo.PeopleRepository

/** What the screens need from the app. The real app provides [AppContainer]; UI tests provide fakes. */
interface AppDependencies {
    val auth: AuthRepository
    val people: PeopleRepository
    val chats: ChatRepository
}
