package br.com.icaroamaral.elophotobridge

import android.content.Context
import android.net.Uri
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import org.json.JSONObject

class SelectedPhotoJavascriptBridge(
  private val context: Context,
  private val onBridgeReady: () -> Unit = {},
  private val onPayloadAccepted: (Int, Int) -> Unit = { _, _ -> },
  private val onPhotoProgress: (Int, Int) -> Unit = { _, _ -> },
  private val onBackToBridge: () -> Unit = {}
) {
  private var payloadJson: String = "{}"
  private var allowedUris: Set<String> = emptySet()

  fun setPayload(payload: String) {
    payloadJson = payload
    allowedUris = extractAllowedUris(payload)
    Log.d(TAG, "PAYLOAD_READY photos=${allowedUris.size}")
    Log.d(TAG, "PHOTO_AUTHORIZED count=${allowedUris.size}")
  }

  @JavascriptInterface
  fun bridgeReady() {
    Log.d(TAG, "BRIDGE_READY")
    onBridgeReady()
  }

  @JavascriptInterface
  fun payloadAccepted(inserted: Int, failed: Int) {
    Log.d(TAG, "PAYLOAD_DISPATCH_SUCCESS inserted=$inserted failed=$failed")
    onPayloadAccepted(inserted, failed)
  }

  @JavascriptInterface
  fun payloadError(message: String) {
    Log.e(TAG, "PAYLOAD_DISPATCH_ERROR message=$message")
  }

  @JavascriptInterface
  fun photoProgress(current: Int, total: Int) {
    Log.d(TAG, "PHOTO_PROGRESS current=$current total=$total")
    onPhotoProgress(current, total)
  }

  @JavascriptInterface
  fun backToBridge() {
    Log.d(TAG, "BACK_TO_PHOTO_BRIDGE")
    onBackToBridge()
  }

  @JavascriptInterface
  fun getPayloadJson(): String = payloadJson

  @JavascriptInterface
  fun getPendingPayloadJson(): String = payloadJson

  @JavascriptInterface
  fun getPhoto(uriValue: String): String = readPhotoDataUrl(uriValue)

  @JavascriptInterface
  fun getPhotoBase64(uriValue: String): String = readPhotoDataUrl(uriValue)

  @JavascriptInterface
  fun readPhotoDataUrl(uriValue: String): String {
    Log.d(TAG, "ANDROID_GET_PHOTO uri=$uriValue")
    Log.d(TAG, "PHOTO_REQUEST uri=$uriValue")
    if (!allowedUris.contains(uriValue)) {
      Log.w(TAG, "PHOTO_ERROR unauthorized_uri=$uriValue")
      return ""
    }

    val uri = Uri.parse(uriValue)
    val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
    return try {
      context.contentResolver.openInputStream(uri)?.use { input ->
        val bytes = input.readBytes()
        Log.d(TAG, "PHOTO_RECEIVED uri=$uriValue bytes=${bytes.size}")
        "data:$mimeType;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
      } ?: ""
    } catch (error: Exception) {
      Log.e(TAG, "PHOTO_ERROR uri=$uriValue message=${error.message}", error)
      ""
    }
  }

  private fun extractAllowedUris(payload: String): Set<String> {
    val result = linkedSetOf<String>()
    val root = runCatching { JSONObject(payload) }.getOrNull() ?: return emptySet()
    val photos = root.optJSONObject("photos") ?: return emptySet()
    val keys = photos.keys()

    while (keys.hasNext()) {
      val category = keys.next()
      val items = photos.optJSONArray(category) ?: continue
      for (index in 0 until items.length()) {
        val uri = items.optJSONObject(index)?.optString("uri").orEmpty()
        if (uri.isNotBlank()) result.add(uri)
      }
    }

    return result
  }

  companion object {
    private const val TAG = "EloPhotoBridge"
  }
}