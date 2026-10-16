plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
}

// Optional per-command relocation; no global environment or user configuration is changed.
providers.gradleProperty("eloWorkRoot").orNull?.let { destination ->
    layout.buildDirectory.set(file(destination).resolve("root-build"))
    subprojects {
        layout.buildDirectory.set(file(destination).resolve(name + "-build"))
    }
}
