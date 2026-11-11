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

    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", "\"$debugApiUrl\"")
        }
        release {
            buildConfigField("String", "API_BASE_URL", "\"${releaseApiUrl ?: "https://unset.invalid"}\"")
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
        unitTests.isReturnDefaultValues = true
    }

    lint {
        // Fail the build on real problems, not on style nits.
        abortOnError = true
        warningsAsErrors = false
    }
}

// Integration tests only run when TEXTSY_API_URL is set; re-run them whenever it changes.
tasks.withType<Test>().configureEach {
    inputs.property("textsyApiUrl", providers.environmentVariable("TEXTSY_API_URL").orElse(""))
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
}
