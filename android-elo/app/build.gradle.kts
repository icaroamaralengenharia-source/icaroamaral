plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    kotlinOptions {
        jvmTarget = "1.8"
    }
    namespace = "br.com.icaroamaral.elo"
    compileSdk = 35

    defaultConfig {
        applicationId = "br.com.icaroamaral.elo"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1"
        manifestPlaceholders["appLabel"] = "ELO Offline Core V2"
    }

    buildTypes {
        getByName("debug") {
            applicationIdSuffix = ".offlinev2test"
            manifestPlaceholders["appLabel"] = "ELO Offline V2 Teste"
        }
    }

    androidResources {
        noCompress += listOf("opus")
    }
}
