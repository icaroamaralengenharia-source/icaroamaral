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

dependencies {
    testImplementation("org.jetbrains.kotlin:kotlin-test:2.0.21")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit:2.0.21")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}

tasks.register<JavaExec>("offlineCoreUnitTest") {
    group = "verification"
    description = "Runs the Offline Core V2 JUnit suite against the compiled Android classes."
    dependsOn("compileDebugKotlin", "compileDebugUnitTestJavaWithJavac")
    mainClass.set("org.junit.runner.JUnitCore")
    classpath = files(
        layout.buildDirectory.dir("intermediates/javac/debugUnitTest/compileDebugUnitTestJavaWithJavac/classes"),
        layout.buildDirectory.dir("tmp/kotlin-classes/debug"),
        configurations.matching { it.name == "debugUnitTestRuntimeClasspath" },
        android.sdkDirectory.resolve("platforms/android-35/android.jar"),
    )
    args("br.com.icaroamaral.elo.EloOfflineEngineTest")
}

tasks.register<Exec>("validateMusicAssets") {
    group = "verification"
    description = "Validates the offline music catalog, assets, and SHA256 manifest."
    workingDir(rootProject.projectDir)
    commandLine("node", "scripts/validate-music-assets.mjs")
}

tasks.named("preBuild") {
    dependsOn("validateMusicAssets")
}
}
