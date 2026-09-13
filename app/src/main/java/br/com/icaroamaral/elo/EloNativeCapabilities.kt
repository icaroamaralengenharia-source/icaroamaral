package br.com.icaroamaral.elo

data class EloNativeCapabilities(
    val version: Int = 2,
    val wake: Boolean = true,
    val nativeTts: Boolean = true,
    val offlineMusic: Boolean = true,
    val offlineCore: Boolean = true,
    val fileChooser: Boolean = true,
    val calculator: Boolean = true,
    val conversions: Boolean = true,
    val engineeringTools: Boolean = true,
    val photoBridge: Boolean = false
) {
    fun toJson(): String {
        return "{" +
            "\"version\":" + version + "," +
            "\"wake\":" + wake + "," +
            "\"nativeTts\":" + nativeTts + "," +
            "\"offlineMusic\":" + offlineMusic + "," +
            "\"offlineCore\":" + offlineCore + "," +
            "\"fileChooser\":" + fileChooser + "," +
            "\"calculator\":" + calculator + "," +
            "\"conversions\":" + conversions + "," +
            "\"engineeringTools\":" + engineeringTools + "," +
            "\"photoBridge\":" + photoBridge +
            "}"
    }
}
