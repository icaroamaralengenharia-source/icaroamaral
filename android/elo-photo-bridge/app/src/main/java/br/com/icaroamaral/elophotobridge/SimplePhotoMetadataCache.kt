package br.com.icaroamaral.elophotobridge

import android.content.Context

class SimplePhotoMetadataCache(context: Context) {
  private val prefs = context.getSharedPreferences("elo_photo_bridge_metadata_cache", Context.MODE_PRIVATE)

  fun cityFor(uri: String): String? = prefs.getString("city:$uri", null)

  fun saveCity(uri: String, city: String?) {
    if (city.isNullOrBlank()) return
    prefs.edit().putString("city:$uri", city).apply()
  }

  fun categoryFor(uri: String): PhotoCategory? {
    return prefs.getString("category:$uri", null)?.let { runCatching { PhotoCategory.valueOf(it) }.getOrNull() }
  }

  fun saveCategory(uri: String, category: PhotoCategory) {
    prefs.edit().putString("category:$uri", category.name).apply()
  }

  fun classificationFor(photo: PhotoMetadata): PhotoClassificationResult? {
    val key = photo.classificationCacheKey()
    val category = prefs.getString("classification_category:$key", null)
      ?.let { runCatching { PhotoCategory.valueOf(it) }.getOrNull() }
      ?: return null
    return PhotoClassificationResult(
      category = category,
      confidence = java.lang.Double.longBitsToDouble(prefs.getLong("classification_confidence:$key", java.lang.Double.doubleToRawLongBits(0.0))),
      reason = prefs.getString("classification_reason:$key", "").orEmpty(),
      source = "cache"
    )
  }

  fun saveClassification(photo: PhotoMetadata, result: PhotoClassificationResult) {
    val key = photo.classificationCacheKey()
    prefs.edit()
      .putString("classification_category:$key", result.category.name)
      .putLong("classification_confidence:$key", java.lang.Double.doubleToRawLongBits(result.confidence))
      .putString("classification_reason:$key", result.reason)
      .apply()
  }

  private fun PhotoMetadata.classificationCacheKey(): String {
    return listOf(uri.toString(), bestInstant()?.toEpochMilli()?.toString().orEmpty(), width?.toString().orEmpty(), height?.toString().orEmpty())
      .joinToString("|")
  }
}