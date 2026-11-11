# Textsy

**Find people nearby who share your interests, and talk to them.**

Textsy is a mobile app (native Android, Kotlin) with a Node.js backend. People sign up with a handle, say what they are into, discover others in their city, and chat in real time. It is being built for a closed beta in Meerut, India, in English and Hindi.

The plan, scope and progress live in [`docs/SPEC.md`](docs/SPEC.md).

## What works today

- **Accounts:** sign up with a handle, invite code and 18+ confirmation; sign in by email or handle; the session is stored encrypted on the device and survives restarts, including opening the app offline.
- **Discovery:** people in your city ranked by shared interests, interest filter chips, and search by name, handle or interest.
- **Chat:** real-time 1:1 messages with sending / failed / sent / seen states, typing indicator, online status, unread counts, paged history, and automatic retry when the connection returns (without duplicates).
- **Safety and privacy:** block and unblock, privacy switches for online status and last seen, email never shown to others, account deletion confirmed with your password.
- **Languages:** English and Hindi, switchable in the app.

Not built yet: Sparks (short "what I'm open to" posts), intro requests, the feed, push notifications, images. See the spec.

## Repository layout

```
android/   Native Android app (Kotlin, Jetpack Compose, Material 3)
backend/   API and real-time server (Node.js, Express, Socket.IO, MongoDB)
docs/      Product and technical spec
```

## Run it locally

You need **Node 20+** and **Android Studio** (or JDK 17+ and the Android SDK).

### 1. Start the backend

```bash
cd backend
npm install
npm run dev:memory    # API on :3000 with a throw-away in-memory MongoDB
```

`npm run dev:memory` downloads a MongoDB binary the first time and forgets all data when you stop it. To use a real MongoDB instead, copy `env.example` to `.env`, set `MONGODB_URI` and `JWT_SECRET`, and run `npm run dev`. Every setting is documented in `backend/env.example`.

Until intro requests exist, "Say hi" opens a chat directly, which the server only allows when `ALLOW_DIRECT_CHAT_CREATION=true`. That is the default outside production; set it explicitly on a beta server that runs in production mode.

### 2. Run the app

Open the `android/` folder in Android Studio and run the `app` configuration.

- **Emulator:** works as is. The emulator reaches your computer at `10.0.2.2`.
- **Physical phone:** put your computer's address in `android/gradle.properties`, for example `textsy.debugApiUrl=http://192.168.1.20:3000`, and make sure the phone is on the same network.

Debug builds allow plain HTTP so local testing needs no certificates. Release builds only talk to HTTPS.

## Tests

```bash
# Backend: tests against a real (in-memory) MongoDB, real HTTP and real WebSockets
cd backend && npm test

# Android: unit tests plus Compose UI tests on the JVM (Robolectric)
cd android && ./gradlew testDebugUnitTest

# Android client against a running backend (skipped unless the URL is set)
cd backend && PORT=3999 npm run dev:memory          # in one terminal
cd android && TEXTSY_API_URL=http://127.0.0.1:3999 ./gradlew testDebugUnitTest --tests '*BackendIntegrationTest*'

# Android lint (also checks that every English string has a Hindi translation)
cd android && ./gradlew lintDebug
```

The first Android UI test run makes Robolectric download an Android framework jar (about 200 MB). To use a copy you already have, set `ROBOLECTRIC_DEPENDENCY_DIR` to a folder containing the `android-all-instrumented-*.jar`.

## Build an APK to share

**Quick, for friends on the same network or a test server over plain HTTP:** a debug APK.

```bash
cd android
./gradlew assembleDebug -Ptextsy.debugApiUrl=http://YOUR-SERVER:3000
# android/app/build/outputs/apk/debug/app-debug.apk
```

**Proper release build (HTTPS, smaller, signed):**

```bash
# Once: create a signing key and keep it safe. Losing it means users must uninstall to update.
keytool -genkeypair -v -keystore textsy.jks -alias textsy -keyalg RSA -keysize 2048 -validity 10000

# Create android/keystore.properties (git-ignored):
#   storeFile=/absolute/path/to/textsy.jks
#   storePassword=...
#   keyAlias=textsy
#   keyPassword=...

cd android
./gradlew assembleRelease -Ptextsy.apiUrl=https://api.your-domain.com
# android/app/build/outputs/apk/release/app-release.apk
```

Release builds refuse to build without `-Ptextsy.apiUrl`, so an app that cannot connect is never produced by accident. The application id is `app.textsy`; it cannot be changed after the first release without users reinstalling, so decide before sharing a build.

## Tech stack

**Android:** Kotlin, Jetpack Compose (Material 3), Navigation Compose, ViewModel and StateFlow, Retrofit, OkHttp, kotlinx.serialization, the Socket.IO Java client, Android Keystore. Tested with JUnit, MockWebServer, Robolectric and Compose UI tests.

**Backend:** Node.js, Express, Socket.IO, MongoDB (Mongoose), bcrypt, JWT, Helmet, rate limiting. Tested with `node:test`, supertest and an in-memory MongoDB.

## Privacy and safety

- Email is used only to sign in and is never returned to other users. No phone number is collected.
- Location is a self-declared area name, never coordinates.
- Blocking hides two people from each other everywhere: discovery, search, profiles and chat.
- The login session is encrypted on the device with a key that never leaves the Android Keystore.
- Deleting an account removes it from the server and closes its conversations.

## Status and known limitations

This is a pre-release. The Android app is verified by automated tests, including the real client against the real backend, but it has not yet been run on a physical device. Other limits:

- No push notifications; messages arrive while the app is open.
- Chat history is not cached offline; unsent messages are queued and retried.
- The Hindi translations are a first draft and should be reviewed by a native speaker.
- The Android Gradle Plugin and AndroidX libraries are pinned to versions compatible with AGP 8.13; Android Studio can upgrade them.

## License

MIT. See [LICENSE](LICENSE).
