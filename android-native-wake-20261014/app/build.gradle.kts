import java.time.Instant
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    fun gitSha(): String = providers.exec {
        commandLine("git", "rev-parse", "--short=12", "HEAD")
        isIgnoreExitValue = true
    }.standardOutput.asText.get().trim().ifBlank { "unknown" }

    kotlinOptions {
        jvmTarget = "1.8"
    }
    namespace = "br.com.icaroamaral.elo"
    compileSdk = 35

    defaultConfig {
        applicationId = "br.com.icaroamaral.elo"
        minSdk = 26
        targetSdk = 35
        versionCode = 9
        versionName = "0.4.3-brain-native-v9"
        buildConfigField("String", "FLAVOR", "\"\"")

        buildConfigField("String", "ELO_BUILD_GIT_SHA", "\"${gitSha()}\"")
        buildConfigField("String", "ELO_BUILD_TIMESTAMP", "\"${Instant.now()}\"")
        buildConfigField("String", "ELO_BUILD_CHANNEL", "\"local-brain-candidate\"")
        buildConfigField("String", "ELO_SHELL_SCHEMA_VERSION", "\"2\"")
        buildConfigField("String", "ELO_WEB_ENTRYPOINT", "\"https://www.icaroamaral.com.br/elo.html\"")
        buildConfigField("String", "ELO_OFFLINE_CATALOG_VERSION", "\"full-offline-v2\"")
    }

    buildFeatures {
        buildConfig = true
    }

    androidResources {
        noCompress += listOf("mp3", "ogg", "oga", "opus")
    }

    sourceSets["main"].assets.srcDir(rootProject.file("model-assets"))
    // Keep the certified native catalog and media intact; no 243 MB duplicate in the source tree.
    val baselineAssets = providers.gradleProperty("eloBaselineAssets")
        .orElse(rootProject.file("../../android-elo-native-header-qa-20261008/app/src/main/assets").absolutePath)
    sourceSets["main"].assets.srcDir(file(baselineAssets.get()))

}

dependencies {
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("com.alphacephei:vosk-android:0.3.75@aar")
    implementation("net.java.dev.jna:jna:5.18.1@aar")
    testImplementation(kotlin("test-junit"))
    testImplementation("org.json:json:20240303")
}

// Source encoding is independent of Windows' native JVM arg-file encoding.
tasks.withType<JavaCompile>().configureEach { options.encoding = "UTF-8" }
tasks.withType<Test>().configureEach {
    maxHeapSize = "192m"
    maxParallelForks = 1
}
