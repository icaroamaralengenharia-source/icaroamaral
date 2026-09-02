package br.com.icaroamaral.elophotobridge

interface PhotoCategoryClassifier {
  fun classify(photo: PhotoMetadata): PhotoCategory
}

class HeuristicPhotoCategoryClassifier : PhotoCategoryClassifier {
  override fun classify(photo: PhotoMetadata): PhotoCategory {
    val name = photo.displayName.lowercase()
    return when {
      listOf("camera", "cam", "cftv").any { name.contains(it) } -> PhotoCategory.CAMERAS
      listOf("tomada", "ponto").any { name.contains(it) } -> PhotoCategory.TOMADAS
      name.contains("rack") -> PhotoCategory.RACK
      listOf("caixa", "fundo", "madeira").all { name.contains(it) } -> PhotoCategory.CAIXA_FUNDO_MADEIRA
      listOf("mastro", "antena").any { name.contains(it) } -> PhotoCategory.MASTRO_ANTENA
      else -> PhotoCategory.UNKNOWN
    }
  }
}
