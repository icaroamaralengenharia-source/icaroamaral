plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "br.com.icaroamaral.elophotobridge"
  compileSdk = 35

  defaultConfig {
    applicationId = "br.com.icaroamaral.elophotobridge"
    minSdk = 29
    targetSdk = 35
    versionCode = 1
    versionName = "0.1.0"
    manifestPlaceholders["appLabel"] = "ELO Photo Bridge"

    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
  }

  buildTypes {
    debug {
      applicationIdSuffix = ".physicaltest"
      versionNameSuffix = "-physicaltest"
      manifestPlaceholders["appLabel"] = "ELO Photo Bridge TESTE"
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }
}

dependencies {
  implementation("androidx.core:core-ktx:1.15.0")
  implementation("androidx.activity:activity-ktx:1.9.3")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("androidx.exifinterface:exifinterface:1.3.7")
  implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
  implementation("androidx.lifecycle:lifecycle-viewmodel-savedstate:2.8.7")
  testImplementation("junit:junit:4.13.2")
}