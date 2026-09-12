package br.com.icaroamaral.elo

import android.content.Context
import org.json.JSONArray
import java.io.File
import java.security.MessageDigest

/** Private persistent store. Assets are bootstrap input; playback uses filesDir. */
class OfflineMusicStore(private val context: Context) {
    private val root = File(context.filesDir, "elo/offline-music")

    fun installBundledCatalog(): Int {
        root.mkdirs()
        val json = context.assets.open("offline-media/catalog.json").bufferedReader().use { it.readText() }
        val items = JSONArray(json)
        var installed = 0
        for (i in 0 until items.length()) {
            val files = items.optJSONObject(i)?.optJSONArray("files") ?: JSONArray()
            for (j in 0 until files.length()) {
                val entry = files.optJSONObject(j) ?: continue
                val assetPath = entry.optString("optimizedPath")
                val expectedHash = entry.optString("optimizedHash")
                val expectedBytes = entry.optLong("optimizedBytes", -1L)
                if (assetPath.isBlank() || expectedHash.isBlank()) continue
                val target = File(root, File(assetPath).name)
                if (valid(target, expectedHash, expectedBytes)) { installed++; continue }
                val temporary = File(root, ".${target.name}.tmp")
                runCatching {
                    context.assets.open(assetPath).use { input -> temporary.outputStream().use { output -> input.copyTo(output) } }
                    check(valid(temporary, expectedHash, expectedBytes)) { "hash inválido: $assetPath" }
                    check(temporary.renameTo(target)) { "não foi possível promover: $assetPath" }
                    installed++
                }.onFailure { temporary.delete() }
            }
        }
        return installed
    }

    fun resolve(assetPath: String): File? {
        val candidate = File(root, File(assetPath).name)
        return candidate.takeIf { it.isFile && it.length() > 0L }
    }

    private fun valid(file: File, expectedHash: String, expectedBytes: Long): Boolean {
        if (!file.isFile || file.length() <= 0L) return false
        if (expectedBytes > 0L && file.length() != expectedBytes) return false
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            var read = input.read(buffer)
            while (read >= 0) {
                if (read > 0) digest.update(buffer, 0, read)
                read = input.read(buffer)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) } == expectedHash
    }
}
