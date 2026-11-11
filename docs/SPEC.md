# Textsy: Product & Technical Spec

| | |
|---|---|
| **Version** | 0.1 (draft) |
| **Last updated** | 2026-11-11 |
| **Owner** | Mohammad Wael |
| **Status legend** | `[ ]` not started · `[~]` partial / mock only · `[x]` done and verified |

This is the single source of truth for what Textsy is, what v1 contains, and how it is built.

> **Verification level.** `[x]` means built and covered by automated tests, including the Android client running against the real backend. **Nothing has been run on a physical Android device yet**, so a device run is still needed before the beta.
Update the checkboxes and the change log as work lands. If code and spec disagree, fix one of them in the same commit.

---

## 1. Vision

**Textsy helps people find others nearby for whatever reason, then chat and share, without choosing an audience first.**

People are friends, collaborators, clients, partners and neighbours at different times.
Existing apps force one audience per app (dating, professional, photos). Textsy is one place where the *reason* is chosen per interaction, not per account.

### Principles

1. **Intent over audience.** Users say what they are open to right now (a *Spark*). They never pick "I am here for dating/work".
2. **Consent before contact.** No cold DMs. A stranger sends an intro request; the receiver accepts or ignores it.
3. **Private by default.** Identity is a handle. Email and phone are never shown. Location is an area name, never coordinates.
4. **Local density before reach.** One city, a small number of people who actually talk, before any growth work.
5. **Ship small and real.** One working end-to-end slice beats many half-built features.
6. **Cheap to run.** One small server, free tiers, open-source components.

### Non-goals for v1

Global virality / trending, ads, video, group chats, swipe-style matching, payments, iOS build, Play Store release,
phone-OTP login, end-to-end encryption, AI features.

## 2. Launch context

- **Where:** Meerut, India. Hindi + English UI.
- **Who:** 18+. First cohort is 10–20 people by word of mouth, then campuses/clubs.
- **How distributed:** sideloaded Android APK built natively (no store listing yet).
- **Infra budget:** one small cloud VM, free tiers, open-source stack.

Because the beta is tiny, v1 deliberately avoids GPS/radius filtering (it would empty every list).
Discovery is by **city and self-declared area**, plus interests.

## 3. Glossary

| Term | Meaning |
|---|---|
| **Handle** | Unique, lowercase public identifier (`3–20` chars of `a-z 0-9 _ .`). The only identity other users see by default. |
| **Spark** | Short, time-boxed post saying what you are open to ("Cricket partner, Sunday 7am"). Tagged with interests. Expires. |
| **Intro request** | A one-time "say hi" from user A to user B, optionally tied to a Spark, with a short note. B accepts or ignores. |
| **Chat** | A 1:1 conversation, created only when an intro request is accepted. |
| **Area** | Self-declared neighbourhood inside the city (e.g. Shastri Nagar). Coarse on purpose. |
| **Post** *(phase 2)* | Text/image post for followers, separate from Sparks. |
| **Circles** *(phase 2, name provisional)* | The set of people you follow. |
| **Lens** *(phase 3)* | A facet of one identity (Social / Professional / Creative) with its own audience. |

## 4. Core user flows (v1)

1. **Onboard:** install APK → register (email, password, handle, invite code) → pick language, city/area, 3+ interests → land on the feed.
2. **Post a Spark:** write text → add interest tags → choose expiry (1 / 3 / 7 days) → it appears in the city feed.
3. **Browse:** feed of active Sparks in my city, newest first; filter by interest chips.
4. **Say hi:** tap a Spark (or a person in *People*) → write a short note → intro request sent.
5. **Accept:** receiver sees the request in an inbox → accept (chat opens with the note as first message) or ignore.
6. **Chat:** realtime 1:1 text chat with history, unread counts, typing indicator.
7. **Stay safe:** block, report, mute notifications, delete account from Settings.

## 5. Features

Priority: **P0** must exist for the beta, **P1** should exist for the beta, **P2** later.

### A. Accounts & identity
- [x] **ACC-1 (P0)** Register with email + password + unique handle; login by email or handle. *(Backend and Android done. Android UI tests + live-backend tests; not yet on a physical device.)*
- [x] **ACC-2 (P0)** Passwords hashed (bcrypt); JWT access token; token stored in secure storage on device. *(bcrypt, JWT, session stored encrypted with an Android Keystore key. The Keystore part cannot run in unit tests, so it is unverified until a device run.)*
- [x] **ACC-3 (P0)** Session restore on app start; logout clears token and socket. *(Saved session is checked on launch, opens offline, and sign-out clears the token and the socket.)*
- [x] **ACC-4 (P1)** Closed-beta invite code required at signup (env-configured list). *(Invite code field on the sign-up screen; the server enforces it when `INVITE_CODES` is set.)*
- [x] **ACC-5 (P1)** Age gate: user confirms they are 18+. *(18+ checkbox; the server refuses sign-up without it.)*
- [x] **ACC-6 (P0)** In-app account deletion (hard delete of user, their Sparks, requests, messages marked deleted). *(Backend and app: password-confirmed, chats retired, messages scrubbed, sockets dropped. Sparks and requests do not exist yet.)*
- [ ] **ACC-7 (P2)** Email verification, password reset.
- [ ] **ACC-8 (P2)** Phone-number OTP login (number never displayed).

### B. Profile
- [x] **PRF-1 (P0)** Edit display name, bio (≤160 chars), avatar (emoji in v1), language, city, area. *(Edit name, bio, avatar emoji and area; language is switched from the profile screen. City is fixed to the configured one.)*
- [x] **PRF-2 (P0)** Interests: choose from a seeded list + custom, max 10, each ≤20 chars. *(Typed as comma-separated text (max 10, 20 characters each). There is no seeded picker yet.)*
- [ ] **PRF-3 (P1)** Photo avatar upload.
- [~] **PRF-4 (P0)** Public profile view by handle (name, bio, interests, area, active Sparks). Never email/phone. *(Public profile endpoint exists and is tested. The app shows a summary on each person card; there is no separate profile screen.)*

### C. Sparks (the core feed)
- [ ] **SPK-1 (P0)** Create Spark: text ≤280, 1–5 tags, expiry 1/3/7 days.
- [ ] **SPK-2 (P0)** City feed of active Sparks, newest first, cursor pagination.
- [ ] **SPK-3 (P0)** Filter feed by interest tags and by area.
- [ ] **SPK-4 (P0)** Close / delete own Spark. Expired Sparks vanish from feeds automatically.
- [ ] **SPK-5 (P1)** Sparks from people I blocked (or who blocked me) never appear.
- [ ] **SPK-6 (P1)** "Matches your interests" ordering boost.
- [ ] **SPK-7 (P2)** Optional distance buckets using device location.

### D. Discovery (People)
- [x] **DSC-1 (P0)** People list in my city, ranked by shared interests, then recent activity. *(People tab ranks by shared interests, with interest filter chips and paging. Android UI tests + live-backend tests; not yet on a physical device.)*
- [x] **DSC-2 (P0)** Search by handle / interest (escaped, case-insensitive, min 2 chars). *(Debounced search by name, handle or interest. Android UI tests + live-backend tests; not yet on a physical device.)*
- [x] **DSC-3 (P1)** Explain the match ("You both like cricket, coffee"). *(Each person shows "You both like ...".)*
- [ ] **DSC-4 (P2)** Hide me from people in my phone contacts.

### E. Intro requests & chat
- [ ] **CHT-1 (P0)** Send intro request (note ≤200 chars), optional Spark reference. One pending request per pair; daily send cap (default 10). *(Not built. Until then "Say hi" opens a chat directly, allowed only while `ALLOW_DIRECT_CHAT_CREATION=true`.)*
- [ ] **CHT-2 (P0)** Inbox of received requests; accept / ignore. Ignored requests are silent to the sender.
- [ ] **CHT-3 (P0)** Accepting creates (or reuses) a direct chat; the note becomes the first message.
- [x] **CHT-4 (P0)** Realtime text messages (≤1000 chars) via WebSocket with ack; history via REST, paginated. *(Realtime send with acknowledgement, paged history. Android UI tests + live-backend tests; not yet on a physical device.)*
- [x] **CHT-5 (P0)** Chat list with last message, time, unread badge; persisted on the server (no local-only chats). *(Chat list with last message, time and unread badge, loaded from the server. Android UI tests + live-backend tests; not yet on a physical device.)*
- [x] **CHT-6 (P1)** Typing indicator, read state ("seen"). *(Typing indicator and "seen". Android UI tests + live-backend tests; not yet on a physical device.)*
- [x] **CHT-7 (P1)** Offline resilience: queued sends retry on reconnect; messages de-duplicated by client id. *(Failed sends are marked and retried automatically on reconnect under the same client id, so they are never duplicated.)*
- [ ] **CHT-8 (P1)** Push notifications for requests and messages (FCM via Expo).
- [ ] **CHT-9 (P2)** Image messages, reactions, replies, edit/delete, search in chat.
- [ ] **CHT-10 (P2)** Group chats, pinned messages, archive.

### F. Safety & moderation
- [~] **SAF-1 (P0)** Block user: mutual invisibility (feeds, search, profile, requests, chat send). *(Block from the chat menu and an unblock list in Profile. Covers discover, search, profile, chat list and chat send. Sparks and requests do not exist yet.)*
- [ ] **SAF-2 (P0)** Report user or Spark with a reason; stored for review.
- [~] **SAF-3 (P0)** Banned users cannot log in, connect a socket, or send anything. *(Login, REST and socket handshake are checked on every request. A socket already open when a ban is applied stays connected until it drops.)*
- [~] **SAF-4 (P0)** Rate limits per user (not only per IP; many Indian mobile users share carrier IPs). *(Login throttle, per-user REST limit and socket send limit are in. Only the login and socket limits have tests.)*
- [ ] **SAF-5 (P1)** Minimal admin CLI/script: list reports, ban/unban, delete content.
- [ ] **SAF-6 (P1)** Terms of Service and Privacy Policy screens; grievance contact email.
- [ ] **SAF-7 (P2)** Selfie/liveness "verified human" badge.

### G. Settings & i18n
- [x] **SET-1 (P0)** Language switch Hindi / English; all strings externalised. *(All strings externalised in English and Hindi; lint fails on a missing translation. The Hindi text is a first draft and needs review by a native speaker.)*
- [x] **SET-2 (P1)** Privacy toggles that actually do something: show online status, show last seen. *(Both switches save to the server and the server honours them. Android UI tests + live-backend tests; not yet on a physical device.)*
- [x] **SET-3 (P1)** Blocked users list with unblock. *(Blocked users screen with unblock.)*

### H. Platform & operations
- [x] **OPS-1 (P0)** App talks to a configurable API base URL (`BuildConfig.API_BASE_URL`, set per build type); no hard-coded localhost. *(`BuildConfig.API_BASE_URL`: debug reads `textsy.debugApiUrl`; release requires `-Ptextsy.apiUrl` and refuses to build without it.)*
- [~] **OPS-2 (P0)** Backend automated tests (auth, sparks, requests, chat) run in CI. *(Backend: 52 tests. Android: 130 JVM tests (unit, repositories, Compose UI) plus 8 live-backend tests. No CI workflow yet.)*
- [ ] **OPS-3 (P0)** Deployment on one VM with HTTPS (reverse proxy), process supervision, Mongo backups.
- [~] **OPS-4 (P0)** Reproducible Android APK build documented. *(Debug and signed release builds work and are documented in the README. The release APK is about 2 MB. Not yet installed on a device.)*
- [ ] **OPS-5 (P1)** Structured logs, `/health`, simple uptime check.
- [ ] **OPS-6 (P2)** Social feed (Posts, Circles, trending) and later video.

## 6. Roadmap & definition of done

| Phase | Scope | Done when |
|---|---|---|
| **0. Make it real** | ACC-1..3, ACC-6, PRF-1/2, CHT-4/5 (chat on a real backend), OPS-1/2, remove mock data, fix known issues in §12 | Two phones on the same server can register, find each other (temporary open chat creation allowed behind a dev flag), exchange messages that survive an app restart. |
| **1. Sparks & consent** | SPK-*, DSC-1/2, CHT-1..3, CHT-6/7, SAF-1..5, SET-*, ACC-4/5, OPS-3/4 | 10–20 real people in Meerut use the APK for two weeks; every conversation started through an accepted intro request. |
| **2. Social feed** | PRF-3, Posts (text + image), Circles (follow), city/interest trending, push (CHT-8) | Users return weekly without being prompted. |
| **3. Growth** | Lenses, Give/Get interests, local-business promotions, tips via UPI, video, Play Store | A few thousand active users, with retention numbers that justify the cost. |

### Beta success metrics (Phase 1)

- **Intro reply rate:** ≥ 50% of intro requests answered within 24 h.
- **Real conversation rate:** ≥ 30% of accepted intros reach 5+ messages.
- **Retention:** ≥ 40% of beta users active in week 2; ≥ 25% in week 4.
- **Safety:** zero unresolved reports older than 48 h.

## 7. Data model (MongoDB / Mongoose)

All collections have `createdAt`/`updatedAt`. IDs are ObjectIds.

**User**
`handle` (unique, lowercase) · `displayName` · `email` (unique, lowercase, private) · `passwordHash` ·
`bio` · `avatar` · `interests[]` · `languages[]` · `city` · `area` ·
`preferences { language, notifications, showOnlineStatus, showLastSeen }` ·
`blockedUsers[]` · `isOnline` · `lastSeen` · `isBanned`, `banReason`, `banExpiresAt` · `isAdmin` · `dobConfirmed18` · `lastActiveAt`
*Indexes:* `handle`, `email`, `{city, area}`, `interests`.

**Spark**
`author` · `text` (≤280) · `tags[]` · `city` · `area` · `expiresAt` · `status` (`active|closed`)
*Indexes:* `{city, status, expiresAt, createdAt:-1}`, `tags`, `author`. TTL on `expiresAt` + grace period.

**IntroRequest**
`from` · `to` · `spark?` · `note` (≤200) · `status` (`pending|accepted|ignored|expired`) · `respondedAt?`
*Constraints:* unique pending pair `(from,to)`; daily cap enforced in code.

**Chat** *(direct only in v1)*
`participants[2]` (sorted) · `lastMessage { messageId, text, sender, createdAt }` (embedded snapshot) ·
`unread { <userId>: Number }` · `lastReadAt { <userId>: Date }` · `isActive`
*Constraint:* unique on the participant pair.

**Message**
`chatId` · `sender` · `text` (≤1000) · `clientId` (unique per sender, for dedupe) · `deletedAt?`
*Indexes:* `{chatId, createdAt:-1}`, `{sender, clientId}` unique.

**Report**
`reporter` · `targetType` (`user|spark|message`) · `targetId` · `reason` · `status` (`open|actioned|dismissed`)

**Phase 2 additions:** `Post`, `Follow`, `Media`.

## 8. API contract (REST, JSON, `/api`)

All endpoints except `register`, `login` and `health` require `Authorization: Bearer <jwt>`.
Errors are `{ "error": "message" }` with an appropriate HTTP status.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` · `GET /auth/me` · `DELETE /auth/me` |
| Profile | `GET /users/me` · `PUT /users/me` · `GET /users/:handle` · `GET /users/search?q=` · `GET /users/discover?tag=&area=&limit=&skip=` |
| Safety | `POST /users/:handle/block` · `DELETE /users/:handle/block` · `GET /users/blocked` · `POST /reports` *(reports not built yet)* |
| Sparks | `POST /sparks` · `GET /sparks?tag=&area=&cursor=` · `GET /sparks/mine` · `DELETE /sparks/:id` |
| Intros | `POST /intros` · `GET /intros/inbox` · `POST /intros/:id/accept` · `POST /intros/:id/ignore` |
| Chats | `GET /chats` · `POST /chats {handle}` *(temporary, behind `ALLOW_DIRECT_CHAT_CREATION`)* · `GET /chats/:id` · `GET /chats/:id/messages?before=&limit=` · `POST /chats/:id/read` |
| Misc | `GET /health` |

### WebSocket (Socket.io)

Auth: JWT in `auth.token` at handshake. Every socket joins a private `user:<id>` room, so events reach a person on all their devices. There are no per-chat rooms.

| Direction | Event | Payload |
|---|---|---|
| client → server | `message:send` | `{ chatId, text, clientId }` with ack `{ ok, message, duplicate }` or `{ ok:false, error, code }` (`invalid_text`, `not_found`, `rate_limited`, …) |
| client → server | `typing` | `{ chatId, isTyping }` |
| client → server | `chat:read` | `{ chatId }` with ack `{ ok }` |
| server → client | `message:new` | `{ message }` |
| server → client | `chat:updated` | `{ chatId, lastMessage?, unread }` (`unread` is the receiving user's own count) |
| server → client | `chat:read` | `{ chatId, userId, readAt }` (the other person read the chat) |
| server → client | `presence` | `{ userId, isOnline, lastSeen }` (only to people who share a chat) |
| server → client | `typing` | `{ chatId, userId, isTyping }` |
| server → client | `intro:new` / `intro:accepted` | `{ intro }` / `{ intro, chat }` |

Presence is **not** broadcast globally. It is only visible to users who share a chat, and only if the other user allows it.

## 9. Architecture & infrastructure

```
 Native Android app (Kotlin, Jetpack Compose)
        │  HTTPS (REST)  +  WSS (Socket.IO)
        ▼
 Reverse proxy (Caddy, automatic TLS)
        │
        ▼
 Node.js + Express + Socket.io  ──────►  MongoDB (same VM, Docker volume)
        │
        └─►  /uploads on local disk (phase 2: S3-compatible storage)
```

- **Mobile (`android/`):** native Android, Kotlin, Jetpack Compose (Material 3), Navigation Compose, ViewModel + StateFlow, Retrofit/OkHttp + kotlinx.serialization, the official Socket.IO Java client, DataStore, and an Android Keystore-encrypted session. Manual dependency injection (no DI framework). `minSdk 26`, `compileSdk/targetSdk 36`. English and Hindi via Android string resources and per-app language.
- **Backend:** Node 22, ESM, Express 4, Socket.io 4, Mongoose 8, `bcryptjs`, `jsonwebtoken`, `express-validator`.
- **No Redis in v1.** One server process makes it unnecessary. Revisit only when running more than one instance.
- **No Firebase in v1.** Own email/password auth (see D1). FCM is added only when push lands (phase 2).
- **Hosting:** one small VM (1 vCPU / 1 GB class is enough for tens of users), Caddy for TLS and a domain or free dynamic-DNS name, systemd or Docker Compose for supervision, daily `mongodump` to a second location.
- **Builds:** Android Studio, or `cd android && ./gradlew assembleRelease -Ptextsy.apiUrl=https://<api-host>`. Debug builds read `textsy.debugApiUrl` from `android/gradle.properties`. The APK is shared by direct link.
- **CI:** GitHub Actions: backend tests, plus Android unit tests and lint, on every push (free for public repos).
- **Config:** every environment-specific value comes from env vars (`backend/env.example`), never from source.

## 10. Privacy, safety & compliance

- **Data minimisation:** email is used for login only and is never returned by any public endpoint. No phone number is collected in v1.
- **Location:** self-declared area only; no GPS, no coordinates stored.
- **Visibility:** blocking is mutual. Blocked users are invisible to each other in feeds, search, profiles, requests and chat.
- **Contact:** intro requests are rate-limited; ignoring is silent.
- **Moderation:** reports are stored and reviewed by the owner within 48 h; severe cases lead to bans.
- **Deletion:** users can delete their account in-app. Data is removed, not just flagged.
- **Age:** 18+ only, self-declared at signup.
- **Legal (to be reviewed by a lawyer before any public launch):** Terms of Service, Privacy Policy, grievance contact, compliance with India's IT Rules 2021 and the DPDP Act 2023.
- **Security baseline:** hashed passwords, JWT secret from env, helmet, CORS allow-list, input validation on every route, escaped regex in search, per-user rate limits.

## 11. Decisions log

| # | Decision | Why | Revisit when |
|---|---|---|---|
| D1 | Own email + password auth instead of Firebase for the beta | No external account/keys, free, works for an APK sideload, one less moving part | Public launch (add phone OTP / Google) |
| D2 | Drop Redis for v1 | Single instance; no caching need at this scale | More than one backend instance |
| D3 | MongoDB, self-hosted on the same VM | Already modelled; free; fine at this scale | Need geo queries/relations beyond what Mongo handles comfortably |
| D4 | Self-declared area instead of GPS | Privacy in a small city, no permissions, works with tiny user counts | Density supports radius filtering |
| D5 | Sparks are the core feed content | Feed is useful from day one without lots of posts | Phase 2 adds Posts |
| D6 | Intro requests gate all chats | Safety and consent; fixes the "cold DM" problem | Never, unless metrics show harm |
| D7 | Direct chats only, text only | Smallest thing that delivers the value | Beta feedback |
| D8 | Android-first, APK sideload | Majority platform, no store review, no fee | Beta ends |
| D11 | **Native Android (Kotlin + Jetpack Compose) instead of React Native / Expo** | Owner has Android Studio and wants a native app; removes the Expo dependency and JS runtime. Cost: Android only; iOS would be a separate app later. | Before any iOS work |
| D12 | `minSdk 26` (Android 8.0), `compileSdk/targetSdk 36` | Covers nearly all active phones in India without desugaring | Usage data from the beta |
| D13 | Application id `app.textsy` | Placeholder. **Cannot change after the first release** without a new install | Before the first APK is shared |
| D14 | AndroidX libraries pinned to AGP 8.13-compatible releases (Compose BOM 2025.10.01, activity 1.11, navigation 2.9, lifecycle 2.9) | The newest releases need AGP 9.1 and compileSdk 37 | Upgrade AGP/Gradle with Android Studio's assistant |
| D9 | Hindi + English from day one | Retrofitting i18n is expensive | n/a |
| D10 | Video, ads, payments deferred | Cost/moderation load too high for solo, unfunded | Thousands of active users |

## 12. Known issues in the current codebase (to fix in Phase 0)

Found by code review; update status as they are fixed.

**Backend**
- [x] `services/socketService.js`: `chat.lastMessage` is assigned an object but the schema defines an ObjectId → saving fails. `readBy` is pushed plain ids but the schema expects `{user, readAt}`. Reactions use `userId` but the schema field is `user`. Message sending is likely broken. **Fixed:** chat last message is an embedded snapshot, read state is per-user counters, reactions are out of scope. A test sends real messages end to end.
- [x] `routes/messages.js`: `chat.updateUnreadCount()` is called in a loop without `await`, each calling `save()` on the same document (parallel-save error / lost updates). **Fixed:** unread counts use one atomic `$inc`; a test fires 10 concurrent sends and checks the count.
- [x] `routes/users.js`: discover `select()` omits `preferences`, so privacy filters always hide online status, last seen and location. The blocked-users `$nin` overwrites the `$ne: userId` filter, so a user can discover themselves. **Fixed:** discovery uses an aggregation, privacy fields are applied, and a test checks that you never discover yourself.
- [x] `routes/users.js`, `models/Message.js`: user input passed straight to `$regex` (injection / ReDoS). **Fixed:** input is escaped; a test tries `.*`, `((`, `[a-` and others.
- [x] `routes/auth.js`: `GET /profile/:firebaseUid` is unauthenticated; signup writes `preferences` fields that do not exist in the schema. **Fixed:** that route is gone and preferences match the schema.
- [x] `services/socketService.js`: `io.emit('user-status-changed')` broadcasts everyone's presence to every client; the online map is in-memory only. **Fixed:** presence goes only to chat counterparts and respects the privacy toggle. Online state is still in memory, so run a single instance.
- [~] `routes/chats.js`: any user can create a chat with any other user (no block check, no consent, participant ids not validated). **Partly fixed:** handles are validated and blocks are respected, and creation is a temporary dev flag that is off in production. Real consent arrives with intro requests.
- [x] Bans and deleted users are only checked on `/users` routes, not on chats, messages or sockets; the JWT is not checked against the database. **Fixed:** one `authenticateToken` is used by every REST route and the socket handshake and hits the database each time.
- [x] `config/database.js`: deprecated Mongo options, Redis v3-style `retry_strategy` (ignored by redis v4), duplicate SIGINT handlers; `app.js` exits the process on any unhandled rejection. **Fixed:** Redis is removed, there is one shutdown handler, and unhandled rejections are logged instead of killing the process.
- [x] `middleware/auth.js`: `requireAdmin` reads `user.isAdmin`, which the schema does not define. Rate limit is per IP only. **Fixed:** the unused admin middleware is removed and limits are per user.
- [~] No tests, no CI, no Dockerfile. **Partly fixed:** 52 integration tests exist; CI and deployment files are still to do.

**Mobile.** The previous Expo/React Native app (all mock data) was removed and replaced by the native Android app, so its list of problems no longer applies.

**Known limitations of the Android app (current)**
- [ ] Not run on a physical device or emulator yet. UI and flows are verified on the JVM with Robolectric and against the real backend.
- [ ] No push notifications, so messages only arrive while the app is open (CHT-8).
- [ ] Chat history is not cached on the device; opening a chat offline shows nothing until the network is back. Unsent messages are queued and retried.
- [ ] The Hindi translations are a first draft and need review by a native speaker.
- [ ] "Say hi" depends on the temporary `ALLOW_DIRECT_CHAT_CREATION` flag. It must be `true` on a beta server running in production mode, until intro requests exist.
- [ ] The delete-account dialog cannot be driven by a Robolectric UI test (any dialog containing a text field never goes idle there). Its rules are covered by `DeleteAccountViewModelTest` instead.
- [ ] The session encryption uses the Android Keystore, which has no unit-test coverage.
- [ ] AGP and AndroidX are pinned for AGP 8.13 (see D14); upgrade with Android Studio's assistant.
- [ ] Application id `app.textsy` is a placeholder (D13).

## 13. Open questions

1. Final name for the follow list (Circles / Orbit / Tribe) and for trending.
2. Domain name for the API, or use a free dynamic-DNS name for the beta.
3. Seed list of Meerut areas and interests (owner to confirm).
4. Who moderates reports during the beta (owner only?) and what is the response-time promise.
5. Do we want email verification before the public launch, or phone OTP instead?

## 14. Change log

| Date | Change |
|---|---|
| 2026-11-11 | Initial spec drafted (v0.1). |
| 2026-11-11 | Backend Phase 0 done: own auth, reworked models, discovery/search/blocking, persisted chats and realtime messaging, 52 passing tests. Known backend issues fixed; spec tables updated to match the implementation. |
| 2026-11-11 | Rebuilt the mobile app natively for Android (Kotlin, Compose). Sign-in, sign-up, chats with live messaging, people discovery and search, profile, privacy, blocking, account deletion, English and Hindi. 138 Android tests, a live-backend suite, lint with no errors, and signed minified release builds. The Expo app was removed. |
