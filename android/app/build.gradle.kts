import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// Backend URL. Debug builds use `textsy.debugApiUrl` (gradle.properties).
// Release builds must be given the URL: ./gradlew assembleRelease -Ptextsy.apiUrl=https://api.example.com
val releaseApiUrl: String? = providers.gradleProperty("textsy.apiUrl").orNull
val debugApiUrl: String = providers.gradleProperty("textsy.debugApiUrl").getOrElse("http://10.0.2.2:3000")

// Signing for release APKs. Create android/keystore.properties (it is git-ignored) with:
//   storeFile=/path/to/textsy.jks
//   storePassword=...
//   keyAlias=textsy
//   keyPassword=...
// Without it, assembleRelease produces an unsigned APK that Android will refuse to install.
val keystoreProperties = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

android {
    namespace = "app.textsy"
    compileSdk = 36

    defaultConfig {
        applicationId = "app.textsy"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        // Languages the app ships translations for (keeps the APK small).
        androidResources.localeFilters += listOf("en", "hi")
    }

    signingConfigs {
        if (keystoreProperties.isNotEmpty()) {
            create("release") {
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", "\"$debugApiUrl\"")
        }
        release {
            buildConfigField("String", "API_BASE_URL", "\"${releaseApiUrl ?: "https://unset.invalid"}\"")
            signingConfig = signingConfigs.findByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    testOptions {
        unitTests {
            isReturnDefaultValues = true
            // Lets Robolectric load the app's real resources (strings, themes) for UI tests.
            isIncludeAndroidResources = true
        }
    }

    lint {
        // Fail the build on real problems, not on style nits.
        abortOnError = true
        warningsAsErrors = false
    }
}

tasks.withType<Test>().configureEach {
    // Integration tests only run when TEXTSY_API_URL is set; re-run them whenever it changes.
    inputs.property("textsyApiUrl", providers.environmentVariable("TEXTSY_API_URL").orElse(""))

    // Robolectric reaches into JDK internals, which JDK 17+ blocks unless the modules are opened.
    jvmArgs(
        "--add-opens=java.base/java.lang=ALL-UNNAMED",
        "--add-opens=java.base/java.io=ALL-UNNAMED",
        "--add-opens=java.base/java.util=ALL-UNNAMED",
        "--add-opens=java.base/java.net=ALL-UNNAMED",
        "--add-opens=java.base/java.nio=ALL-UNNAMED",
        "--add-opens=java.base/sun.nio.ch=ALL-UNNAMED",
        "--add-exports=java.base/jdk.internal.access=ALL-UNNAMED",
    )

    // Optional: point Robolectric at a local folder of android-all jars instead of letting it download
    // them (offline machines, CI caches, throttled networks).
    providers.environmentVariable("ROBOLECTRIC_DEPENDENCY_DIR").orNull?.let { dir ->
        systemProperty("robolectric.offline", "true")
        systemProperty("robolectric.dependency.dir", dir)
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

// A release build pointing at a placeholder URL would ship an app that cannot connect.
gradle.taskGraph.whenReady {
    val buildsRelease = allTasks.any { it.project == project && it.name.matches(Regex("(assemble|bundle|package)Release")) }
    if (buildsRelease && releaseApiUrl == null) {
        throw GradleException("Release builds need the backend URL: -Ptextsy.apiUrl=https://your-api-host")
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.activity.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.core)
    implementation(libs.androidx.compose.ui.tooling.preview)
    debugImplementation(libs.androidx.compose.ui.tooling)

    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)

    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.retrofit)
    implementation(libs.retrofit.kotlinx.serialization)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.socketio.client) {
        // Android already ships org.json.
        exclude(group = "org.json", module = "json")
    }

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)
    testImplementation(libs.okhttp.mockwebserver)
    testImplementation(libs.org.json)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.ext.junit)
    testImplementation(libs.androidx.test.core)
    testImplementation(platform(libs.androidx.compose.bom))
    testImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}
