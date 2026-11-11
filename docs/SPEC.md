# Textsy: Product & Technical Spec

| | |
|---|---|
| **Version** | 0.1 (draft) |
| **Last updated** | 2026-11-11 |
| **Owner** | Mohammad Wael |
| **Status legend** | `[ ]` not started · `[~]` partial / mock only · `[x]` done and verified |

This is the single source of truth for what Textsy is, what v1 contains, and how it is built.
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
- **How distributed:** sideloaded Android APK (no store listing yet).
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
- [~] **ACC-1 (P0)** Register with email + password + unique handle; login by email or handle. *(Backend done and tested. App UI is still mocked.)*
- [~] **ACC-2 (P0)** Passwords hashed (bcrypt); JWT access token; token stored in secure storage on device. *(Backend done. Secure storage on the device pending.)*
- [ ] **ACC-3 (P0)** Session restore on app start; logout clears token and socket.
- [~] **ACC-4 (P1)** Closed-beta invite code required at signup (env-configured list). *(Backend done. Field missing in the app.)*
- [~] **ACC-5 (P1)** Age gate: user confirms they are 18+. *(Backend enforces it. Checkbox missing in the app.)*
- [~] **ACC-6 (P0)** In-app account deletion (hard delete of user, their Sparks, requests, messages marked deleted). *(Backend done: password-confirmed, chats retired, messages scrubbed, sockets dropped. Sparks/requests do not exist yet. App button is still a TODO.)*
- [ ] **ACC-7 (P2)** Email verification, password reset.
- [ ] **ACC-8 (P2)** Phone-number OTP login (number never displayed).

### B. Profile
- [~] **PRF-1 (P0)** Edit display name, bio (≤160 chars), avatar (emoji in v1), language, city, area. *(`PUT /users/me` done and tested. Edit screen is a TODO.)*
- [~] **PRF-2 (P0)** Interests: choose from a seeded list + custom, max 10, each ≤20 chars. *(Backend normalises, dedupes and limits them. Picker UI missing.)*
- [ ] **PRF-3 (P1)** Photo avatar upload.
- [~] **PRF-4 (P0)** Public profile view by handle (name, bio, interests, area, active Sparks). Never email/phone. *(`GET /users/:handle` done and tested; no Sparks yet; no screen.)*

### C. Sparks (the core feed)
- [ ] **SPK-1 (P0)** Create Spark: text ≤280, 1–5 tags, expiry 1/3/7 days.
- [ ] **SPK-2 (P0)** City feed of active Sparks, newest first, cursor pagination.
- [ ] **SPK-3 (P0)** Filter feed by interest tags and by area.
- [ ] **SPK-4 (P0)** Close / delete own Spark. Expired Sparks vanish from feeds automatically.
- [ ] **SPK-5 (P1)** Sparks from people I blocked (or who blocked me) never appear.
- [ ] **SPK-6 (P1)** "Matches your interests" ordering boost.
- [ ] **SPK-7 (P2)** Optional distance buckets using device location.

### D. Discovery (People)
- [~] **DSC-1 (P0)** People list in my city, ranked by shared interests, then recent activity. *(Backend done and tested. Explore screen still shows mock data.)*
- [~] **DSC-2 (P0)** Search by handle / interest (escaped, case-insensitive, min 2 chars). *(Backend done and tested.)*
- [ ] **DSC-3 (P1)** Explain the match ("You both like cricket, coffee").
- [ ] **DSC-4 (P2)** Hide me from people in my phone contacts.

### E. Intro requests & chat
- [ ] **CHT-1 (P0)** Send intro request (note ≤200 chars), optional Spark reference. One pending request per pair; daily send cap (default 10).
- [ ] **CHT-2 (P0)** Inbox of received requests; accept / ignore. Ignored requests are silent to the sender.
- [ ] **CHT-3 (P0)** Accepting creates (or reuses) a direct chat; the note becomes the first message.
- [~] **CHT-4 (P0)** Realtime text messages (≤1000 chars) via WebSocket with ack; history via REST, paginated. *(Backend done and tested. App not wired.)*
- [~] **CHT-5 (P0)** Chat list with last message, time, unread badge; persisted on the server (no local-only chats). *(Backend done and tested. App still uses local mock chats.)*
- [~] **CHT-6 (P1)** Typing indicator, read state ("seen"). *(Backend done and tested.)*
- [~] **CHT-7 (P1)** Offline resilience: queued sends retry on reconnect; messages de-duplicated by client id. *(Server-side de-duplication done and tested. Client queue pending.)*
- [ ] **CHT-8 (P1)** Push notifications for requests and messages (FCM via Expo).
- [ ] **CHT-9 (P2)** Image messages, reactions, replies, edit/delete, search in chat.
- [ ] **CHT-10 (P2)** Group chats, pinned messages, archive.

### F. Safety & moderation
- [~] **SAF-1 (P0)** Block user: mutual invisibility (feeds, search, profile, requests, chat send). *(Done for discover, search, profile, chat list and chat send. Sparks and requests do not exist yet. No app UI.)*
- [ ] **SAF-2 (P0)** Report user or Spark with a reason; stored for review.
- [~] **SAF-3 (P0)** Banned users cannot log in, connect a socket, or send anything. *(Login, REST and socket handshake are checked on every request. A socket already open when a ban is applied stays connected until it drops.)*
- [~] **SAF-4 (P0)** Rate limits per user (not only per IP; many Indian mobile users share carrier IPs). *(Login throttle, per-user REST limit and socket send limit are in. Only the login and socket limits have tests.)*
- [ ] **SAF-5 (P1)** Minimal admin CLI/script: list reports, ban/unban, delete content.
- [ ] **SAF-6 (P1)** Terms of Service and Privacy Policy screens; grievance contact email.
- [ ] **SAF-7 (P2)** Selfie/liveness "verified human" badge.

### G. Settings & i18n
- [ ] **SET-1 (P0)** Language switch Hindi / English; all strings externalised.
- [~] **SET-2 (P1)** Privacy toggles that actually do something: show online status, show last seen. *(Backend honours both in profiles and presence. The app toggles are still local state.)*
- [~] **SET-3 (P1)** Blocked users list with unblock. *(Backend done. No screen.)*

### H. Platform & operations
- [ ] **OPS-1 (P0)** App talks to a configurable API base URL (`EXPO_PUBLIC_API_URL`); no hard-coded localhost.
- [~] **OPS-2 (P0)** Backend automated tests (auth, sparks, requests, chat) run in CI. *(52 tests pass locally against real MongoDB. CI workflow still to add. Sparks/requests will add tests.)*
- [ ] **OPS-3 (P0)** Deployment on one VM with HTTPS (reverse proxy), process supervision, Mongo backups.
- [ ] **OPS-4 (P0)** Reproducible Android APK build documented.
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
 Android APK (Expo / React Native, TypeScript)
        │  HTTPS (REST)  +  WSS (Socket.io)
        ▼
 Reverse proxy (Caddy, automatic TLS)
        │
        ▼
 Node.js + Express + Socket.io  ──────►  MongoDB (same VM, Docker volume)
        │
        └─►  /uploads on local disk (phase 2: S3-compatible storage)
```

- **Mobile:** Expo SDK 53, Expo Router, React Context, `expo-secure-store` for the token.
- **Backend:** Node 22, ESM, Express 4, Socket.io 4, Mongoose 8, `bcryptjs`, `jsonwebtoken`, `express-validator`.
- **No Redis in v1.** One server process makes it unnecessary. Revisit only when running more than one instance.
- **No Firebase in v1.** Own email/password auth (see D1). FCM is added only when push lands (phase 2).
- **Hosting:** one small VM (1 vCPU / 1 GB class is enough for tens of users), Caddy for TLS and a domain or free dynamic-DNS name, systemd or Docker Compose for supervision, daily `mongodump` to a second location.
- **Builds:** `eas build --profile preview --platform android` (free tier) or a local Gradle build; APK shared via direct link.
- **CI:** GitHub Actions: backend tests and mobile lint/typecheck on every push (free for public repos).
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

**Mobile**
- [ ] `contexts/AuthContext.tsx`: sign-in always returns the same hard-coded user (`Alex Chen`, id `1`); the password is logged to the console.
- [ ] `app/(tabs)/explore.tsx`, `app/(tabs)/chat.tsx`: hard-coded mock users/chats; like/pass are TODOs; match score is a constant.
- [ ] `contexts/MessagingContext.tsx`: `senderId` is `'current-user-id'`; `createChat` only writes to AsyncStorage; chat state is saved from stale closures.
- [ ] `app/chat/[id].tsx`: chat partner is mocked; the chat id is passed as the receiver id.
- [ ] `services/WebSocketService.ts`: URL is `ws://localhost:3000` and no auth token is set; it listens to `new-message` but never joins rooms reliably.
- [ ] `app/(tabs)/index.tsx` is still the Expo starter screen.
- [ ] `app/(tabs)/profile.tsx`: toggles are local state only; edit profile, blocked users and delete account are TODOs.
- [ ] No i18n; no environment-based API URL.

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
