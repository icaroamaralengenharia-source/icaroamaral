package br.com.icaroamaral.elo

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.util.Log
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResult
import androidx.activity.result.contract.ActivityResultContracts

class EloFileChooserController(
    activity: ComponentActivity
) {
    private val hostActivity = activity
    private var pendingCallback: ValueCallback<Array<Uri>>? = null

    private val launcher = activity.registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        Log.i(FILE_CHOOSER_LOG_TAG, "result code=${result.resultCode} hasData=${result.data != null}")
        val callback = pendingCallback
        pendingCallback = null

        if (callback == null) return@registerForActivityResult

        if (result.resultCode != Activity.RESULT_OK) {
            callback.onReceiveValue(null)
            return@registerForActivityResult
        }

        val uris = extractUris(result)
        Log.i(FILE_CHOOSER_LOG_TAG, "selected count=${uris?.size ?: 0} uri=${uris?.firstOrNull()}")
        persistReadPermission(result, uris)
        callback.onReceiveValue(uris)
    }

    fun onShowFileChooser(
        webView: WebView?,
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: WebChromeClient.FileChooserParams?
    ): Boolean {
        Log.i(FILE_CHOOSER_LOG_TAG, "show chooser accept=${fileChooserParams?.acceptTypes?.contentToString()} mode=${fileChooserParams?.mode}")
        pendingCallback?.onReceiveValue(null)
        pendingCallback = filePathCallback

        if (filePathCallback == null) {
            pendingCallback = null
            return false
        }

        val allowMultiple =
            fileChooserParams?.mode ==
                WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE

        val accepted = normalizeAcceptedTypes(
            fileChooserParams?.acceptTypes.orEmpty()
        )

        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = accepted.singleOrNull() ?: "*/*"
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, allowMultiple)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)

            if (accepted.size > 1) {
                putExtra(Intent.EXTRA_MIME_TYPES, accepted.toTypedArray())
            }
        }

        return runCatching {
            launcher.launch(intent)
            Log.i(FILE_CHOOSER_LOG_TAG, "chooser launched type=${intent.type} multiple=$allowMultiple")
            true
        }.getOrElse {
            Log.e(FILE_CHOOSER_LOG_TAG, "chooser launch failed", it)
            pendingCallback?.onReceiveValue(null)
            pendingCallback = null
            false
        }
    }

    fun cancelPending() {
        pendingCallback?.onReceiveValue(null)
        pendingCallback = null
    }

    companion object {
        private const val FILE_CHOOSER_LOG_TAG = "ELO_FILE_CHOOSER"

        internal fun normalizeAcceptedTypes(types: Array<out String>): List<String> {
            val normalized =
                types
                    .asSequence()
                    .flatMap { it.split(",").asSequence() }
                    .map { it.trim().lowercase() }
                    .filter { it.isNotBlank() }
                    .mapNotNull(::mapExtensionToMime)
                    .distinct()
                    .toList()

            return normalized.ifEmpty {
                listOf(
                    "application/pdf",
                    "image/*",
                    "text/plain",
                    "text/csv"
                )
            }
        }

        private fun mapExtensionToMime(value: String): String? =
            when (value) {
                ".pdf",
                "application/pdf" ->
                    "application/pdf"

                ".png",
                "image/png" ->
                    "image/png"

                ".jpg",
                ".jpeg",
                "image/jpeg" ->
                    "image/jpeg"

                "image/*" ->
                    "image/*"

                ".txt",
                "text/plain" ->
                    "text/plain"

                ".csv",
                "text/csv",
                "application/csv" ->
                    "text/csv"

                ".docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ->
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

                ".xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ->
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

                "*/*" ->
                    "*/*"

                else ->
                    if (value.contains("/")) value else null
            }

    }

    private fun extractUris(result: ActivityResult): Array<Uri>? {
        val data = result.data ?: return null

        data.clipData?.let { clip ->
            if (clip.itemCount > 0) {
                return Array(clip.itemCount) { index ->
                    clip.getItemAt(index).uri
                }
            }
        }

        return data.data?.let { arrayOf(it) }
    }

    private fun persistReadPermission(result: ActivityResult, uris: Array<Uri>?) {
        val data = result.data ?: return
        val readFlag = data.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION
        if (readFlag == 0 || uris.isNullOrEmpty()) return
        uris.forEach { uri ->
            runCatching {
                hostActivity.contentResolver.takePersistableUriPermission(uri, readFlag)
            }
        }
    }
}
