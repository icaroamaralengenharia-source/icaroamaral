package br.com.icaroamaral.elo

data class EloNativeCapabilities(
    val version: Int = 1,
    val wake: Boolean = true,
    val nativeTts: Boolean = true,
    val offlineMusic: Boolean = true,
    val offlineCore: Boolean = true,
    val photoBridge: Boolean = false
) {
    fun toJson(): String {
        return "{" +
            "\"version\":" + version + "," +
            "\"wake\":" + wake + "," +
            "\"nativeTts\":" + nativeTts + "," +
            "\"offlineMusic\":" + offlineMusic + "," +
            "\"offlineCore\":" + offlineCore + "," +
            "\"photoBridge\":" + photoBridge +
            "}"
    }
}
