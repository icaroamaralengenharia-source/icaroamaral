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
    }

    androidResources {
        noCompress += listOf("mp3", "ogg", "oga")
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
    testImplementation(kotlin("test-junit"))
}
