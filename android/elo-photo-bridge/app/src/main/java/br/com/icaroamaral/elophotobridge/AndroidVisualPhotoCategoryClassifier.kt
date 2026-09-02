package br.com.icaroamaral.elophotobridge

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.text.Normalizer
import java.util.Locale

interface VisualPhotoCategoryClassifier {
  suspend fun classify(photo: PhotoMetadata): PhotoClassificationResult
}

class AndroidVisualPhotoCategoryClassifier(
  private val context: Context,
  private val config: BridgeConfig,
  private val cache: SimplePhotoMetadataCache,
  private val allowRemoteVisualAnalysis: () -> Boolean,
  private val heuristic: PhotoCategoryClassifier = HeuristicPhotoCategoryClassifier()
) : VisualPhotoCategoryClassifier {
  override suspend fun classify(photo: PhotoMetadata): PhotoClassificationResult = withContext(Dispatchers.IO) {
    cache.classificationFor(photo)?.let { cached ->
      Log.d("EloPhotoBridge", "PHOTO_CLASSIFICATION_CACHE uri=${photo.uri} category=${cached.category.name}")
      return@withContext cached
    }

    if (!allowRemoteVisualAnalysis()) {
      val fallback = heuristic.classify(photo)
      return@withContext PhotoClassificationResult(
        category = if (fallback == PhotoCategory.UNKNOWN) PhotoCategory.UNKNOWN else fallback,
        confidence = if (fallback == PhotoCategory.UNKNOWN) 0.0 else 0.45,
        reason = "remote_visual_analysis_not_authorized",
        source = if (fallback == PhotoCategory.UNKNOWN) "manual_required" else "heuristic_without_upload"
      )
    }

    val result = runCatching { classifyWithBackend(photo) }.getOrElse { error ->
      Log.w("EloPhotoBridge", "PHOTO_CLASSIFICATION_ERROR uri=${photo.uri} error=${error.message}")
      val fallback = heuristic.classify(photo)
      PhotoClassificationResult(
        category = if (fallback == PhotoCategory.UNKNOWN) PhotoCategory.UNKNOWN else fallback,
        confidence = if (fallback == PhotoCategory.UNKNOWN) 0.0 else 0.45,
        reason = error.message ?: "backend_unavailable",
        source = if (fallback == PhotoCategory.UNKNOWN) "error" else "heuristic_after_error"
      )
    }

    cache.saveClassification(photo, result)
    result
  }

  private fun classifyWithBackend(photo: PhotoMetadata): PhotoClassificationResult {
    val encodedImage = compressPhotoToBase64(photo.uri)
    val body = JSONObject()
      .put("image", JSONObject()
        .put("base64", encodedImage.base64)
        .put("mimeType", "image/jpeg")
        .put("fileName", photo.displayName)
        .put("width", encodedImage.width)
        .put("height", encodedImage.height))
      .put("context", JSONObject()
        .put("mode", "photo")
        .put("source", "ELO_PHOTO_BRIDGE")
        .put("imageLabel", "Classificar foto SGTO/STELECOM em exatamente uma destas categorias: CAMERAS, TOMADAS, RACK, CAIXA_FUNDO_MADEIRA, MASTRO_ANTENA ou UNKNOWN. Responder categoriaProvavel com uma dessas chaves e confianca numerica de 0 a 1.")
        .put("allowedCategories", JSONArray(listOf(PhotoCategory.CAMERAS, PhotoCategory.TOMADAS, PhotoCategory.RACK, PhotoCategory.CAIXA_FUNDO_MADEIRA, PhotoCategory.MASTRO_ANTENA, PhotoCategory.UNKNOWN).map { it.name }))
        .put("confidenceThreshold", 0.72))
      .toString()

    val connection = (URL(config.visualAnalysisUrl).openConnection() as HttpURLConnection).apply {
      requestMethod = "POST"
      connectTimeout = config.visualClassificationTimeoutMs.toInt()
      readTimeout = config.visualClassificationTimeoutMs.toInt()
      setRequestProperty("Content-Type", "application/json")
      doOutput = true
    }

    try {
      connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
      val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
      val responseText = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
      if (connection.responseCode !in 200..299) throw IllegalStateException("backend_${connection.responseCode}")
      return parseBackendResponse(responseText)
    } finally {
      connection.disconnect()
    }
  }

  private fun parseBackendResponse(responseText: String): PhotoClassificationResult {
    val root = JSONObject(responseText)
    val analysis = root.optJSONObject("analysis") ?: root
    val category = parseCategory(
      analysis.optString("categoriaSgtoStelecom", analysis.optString("photoCategory", analysis.optString("category", analysis.optString("categoriaProvavel"))))
    )
    val confidence = parseConfidence(analysis.opt("confidence") ?: analysis.opt("confianca"))
    val accepted = category != PhotoCategory.UNKNOWN && confidence >= 0.72
    return PhotoClassificationResult(
      category = if (accepted) category else PhotoCategory.UNKNOWN,
      confidence = confidence,
      reason = analysis.optString("reason", analysis.optString("justificativa", analysis.optString("descricaoTecnica", ""))).take(180),
      source = "vision"
    )
  }

  private fun parseCategory(value: String?): PhotoCategory {
    val normalized = Normalizer.normalize(value.orEmpty(), Normalizer.Form.NFD)
      .replace("\\p{Mn}+".toRegex(), "")
      .uppercase(Locale.ROOT)
      .replace("[^A-Z0-9]+".toRegex(), "_")
      .trim('_')
    return PhotoCategory.values().firstOrNull { it.name == normalized } ?: PhotoCategory.UNKNOWN
  }

  private fun parseConfidence(value: Any?): Double {
    return when (value) {
      is Number -> value.toDouble().coerceIn(0.0, 1.0)
      is String -> {
        val normalized = value.lowercase(Locale.ROOT).trim()
        when {
          normalized == "alta" || normalized == "alto" -> 0.9
          normalized == "media" || normalized == "média" || normalized == "medio" || normalized == "médio" -> 0.65
          normalized == "baixa" || normalized == "baixo" -> 0.3
          else -> value.replace(",", ".").toDoubleOrNull()?.let { if (it > 1.0) it / 100.0 else it }?.coerceIn(0.0, 1.0) ?: 0.0
        }
      }
      else -> 0.0
    }
  }

  private fun compressPhotoToBase64(uri: Uri): EncodedImage {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
    val sampleSize = computeSampleSize(bounds.outWidth, bounds.outHeight)
    val options = BitmapFactory.Options().apply { inSampleSize = sampleSize }
    val bitmap = context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) }
      ?: throw IllegalStateException("image_decode_failed")
    return bitmap.useAsJpegBase64()
  }

  private fun Bitmap.useAsJpegBase64(): EncodedImage {
    val output = ByteArrayOutputStream()
    compress(Bitmap.CompressFormat.JPEG, 72, output)
    val result = EncodedImage(Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP), width, height)
    recycle()
    return result
  }

  private fun computeSampleSize(width: Int, height: Int): Int {
    val longest = maxOf(width, height)
    var sample = 1
    while (longest / sample > 1280) sample *= 2
    return sample.coerceAtLeast(1)
  }

  private data class EncodedImage(val base64: String, val width: Int, val height: Int)
}
