import java.time.Instant
import java.security.MessageDigest
import groovy.json.JsonOutput
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
        versionCode = 11
        versionName = "0.4.5-brain-final-v11"
        val qaInference = providers.gradleProperty("eloQaInferenceBaseUrl").orElse("").get()
        require(qaInference in setOf("", "https://elo-brain-qa-v11-20261016.onrender.com")) { "UNTRUSTED_QA_INFERENCE_URL" }
        buildConfigField("String", "ELO_INFERENCE_BASE_URL", "\"$qaInference\"")
        buildConfigField("String", "FLAVOR", "\"\"")

        buildConfigField("String", "ELO_BUILD_GIT_SHA", "\"${gitSha()}\"")
        buildConfigField("String", "ELO_BUILD_TIMESTAMP", "\"${Instant.now()}\"")
        buildConfigField("String", "ELO_BUILD_CHANNEL", "\"${if (qaInference.isBlank()) "local-brain-candidate" else "qa-inference-v11"}\"")
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
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/eloWebAssets"))

}

val canonicalWebFiles = listOf("elo.html", "elo.css", "elo-sw.js",
    "elo-viewport", "elo-voice-session", "elo-assistente", "elo-media-player",
    "elo-music-resolver", "elo-offline-media-library", "elo-communication-policy",
    "elo-proactive-reasoning-policy", "elo-technical-validator", "elo-brain-router", "elo-offline-core-v2")
    .map { if (it.contains('.')) it else "relatorio-qualidade-obras/$it.js" }
val bundleCanonicalEloWeb by tasks.registering(Copy::class) {
    from(rootProject.projectDir.parentFile) { include(canonicalWebFiles) }
    into(layout.buildDirectory.dir("generated/eloWebAssets/elo-web"))
    doLast {
        val hashes = canonicalWebFiles.associateWith { path ->
            val bytes = rootProject.projectDir.parentFile.resolve(path).readBytes()
            MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        }
        destinationDir.resolve("manifest.json").writeText(JsonOutput.toJson(mapOf("version" to "20261016-brain-final-v4", "sha256" to hashes)))
    }
}
tasks.named("preBuild").configure { dependsOn(bundleCanonicalEloWeb) }

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
