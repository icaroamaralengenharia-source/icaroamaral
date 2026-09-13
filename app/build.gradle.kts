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
        versionCode = 3
        versionName = "0.3.0"

        buildConfigField("String", "ELO_BUILD_GIT_SHA", "\"${gitSha()}\"")
        buildConfigField("String", "ELO_BUILD_TIMESTAMP", "\"${Instant.now()}\"")
        buildConfigField("String", "ELO_BUILD_CHANNEL", "\"local-audit\"")
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

    testOptions {
        unitTests.all {
            val localTestClasses = files(
                "$buildDir/tmp/kotlin-classes/debugUnitTest",
                "$buildDir/intermediates/javac/debugUnitTest/compileDebugUnitTestJavaWithJavac/classes"
            )
            it.classpath = it.classpath.plus(localTestClasses)
        }
    }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.9.3")
    testImplementation(kotlin("test-junit"))
}
