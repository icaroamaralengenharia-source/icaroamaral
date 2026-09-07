package br.com.icaroamaral.elophotobridge

import java.time.Instant

object TimelineOrganizer {
  val orderedCategories = listOf(
    PhotoCategory.MASTRO_ANTENA,
    PhotoCategory.CAMERAS_EXTERNAS,
    PhotoCategory.CAMERAS_INTERNAS,
    PhotoCategory.TOMADAS,
    PhotoCategory.RACK,
    PhotoCategory.CAIXA_FUNDO_MADEIRA
  )

  fun defaultCuts(photoCount: Int): Map<PhotoCategory, Int> {
    return emptyMap()
  }

  fun validateCuts(photoCount: Int, cuts: Map<PhotoCategory, Int>): TimelineValidationResult {
    if (photoCount <= 0) return TimelineValidationResult(false, "Nenhuma foto encontrada para organizar.")
    val missing = orderedCategories.firstOrNull { cuts[it] == null }
    if (missing != null) return TimelineValidationResult(false, "${label(missing)} ainda precisa de ponto de inicio.")
    val indices = orderedCategories.map { cuts.getValue(it) }
    val outOfBounds = orderedCategories.zip(indices).firstOrNull { (_, index) -> index !in 0 until photoCount }
    if (outOfBounds != null) return TimelineValidationResult(false, "${label(outOfBounds.first)} aponta para uma foto fora da visita.")
    return TimelineValidationResult(true, "Marcadores validos.")
  }

  fun distribute(
    photos: List<PhotoMetadata>,
    cuts: Map<PhotoCategory, Int>,
    manualCategories: Map<String, PhotoCategory> = emptyMap()
  ): List<ClassifiedPhoto> {
    val ordered = photos.sortedBy { it.bestInstant() ?: Instant.EPOCH }
    val validation = validateCuts(ordered.size, cuts)
    require(validation.ok) { validation.message }
    val indexedCuts = orderedCategories
      .map { it to cuts.getValue(it) }
      .sortedWith(compareBy<Pair<PhotoCategory, Int>> { it.second }.thenBy { orderedCategories.indexOf(it.first) })
    return ordered.mapIndexed { index, photo ->
      val automaticCategory = (indexedCuts.lastOrNull { (_, startIndex) -> index >= startIndex } ?: indexedCuts.first()).first
      val category = manualCategories[photo.uri.toString()] ?: automaticCategory
      ClassifiedPhoto(
        metadata = photo,
        category = category.toReportCategory(),
        confidence = 1.0,
        reason = if (manualCategories.containsKey(photo.uri.toString())) "manual_category_adjustment" else "timeline_cut_points",
        source = PhotoBridgeMode.SGTO_FAST_TIMELINE.name
      )
    }
  }

  fun label(category: PhotoCategory): String {
    return when (category) {
      PhotoCategory.CAMERAS -> "Cameras"
      PhotoCategory.CAMERAS_EXTERNAS -> "Cameras externas"
      PhotoCategory.CAMERAS_INTERNAS -> "Cameras internas"
      PhotoCategory.TOMADAS -> "Tomadas"
      PhotoCategory.RACK -> "Rack"
      PhotoCategory.MASTRO_ANTENA -> "Mastro/Antena"
      PhotoCategory.CAIXA_FUNDO_MADEIRA -> "Caixa fundo madeira"
      PhotoCategory.TOMADA_DADOS -> "Tomada de dados"
      PhotoCategory.TOMADA_CABO_PRETO -> "Tomada/cabo preto"
      PhotoCategory.UNKNOWN -> "Nao classificadas"
    }
  }

  private fun PhotoCategory.toReportCategory(): PhotoCategory {
    return when (this) {
      PhotoCategory.CAMERAS_EXTERNAS,
      PhotoCategory.CAMERAS_INTERNAS -> PhotoCategory.CAMERAS
      PhotoCategory.TOMADA_DADOS,
      PhotoCategory.TOMADA_CABO_PRETO -> PhotoCategory.TOMADAS
      else -> this
    }
  }
}

data class TimelineValidationResult(
  val ok: Boolean,
  val message: String
)
