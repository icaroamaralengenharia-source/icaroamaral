package br.com.icaroamaral.elophotobridge

import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

object TimeWindowOrganizer {
  const val WORKFLOW_VERSION = 2

  val categories = listOf(
    PhotoCategory.CAMERAS,
    PhotoCategory.TOMADAS,
    PhotoCategory.RACK,
    PhotoCategory.MASTRO_ANTENA,
    PhotoCategory.CAIXA_FUNDO_MADEIRA
  )

  fun parseTimeInput(value: String): TimeWindowBoundary? {
    val match = Regex("""^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$""").matchEntire(value) ?: return null
    val hour = match.groupValues[1].toInt()
    val minute = match.groupValues[2].toInt()
    val second = match.groupValues[3].takeIf(String::isNotBlank)?.toInt() ?: 0
    if (hour !in 0..23 || minute !in 0..59 || second !in 0..59) return null
    return TimeWindowBoundary(LocalTime.of(hour, minute, second), match.groupValues[3].isNotBlank())
  }

  fun parseNaturalCommand(text: String): CategoryWindowCommand? {
    val normalized = normalize(text)
    val category = when {
      Regex("""\bcameras?\b|\bcftv\b""").containsMatchIn(normalized) -> PhotoCategory.CAMERAS
      Regex("""\btomadas?\b|\bpontos?\b""").containsMatchIn(normalized) -> PhotoCategory.TOMADAS
      Regex("""\brack\b""").containsMatchIn(normalized) -> PhotoCategory.RACK
      Regex("""\bmastro\b|\bantena\b""").containsMatchIn(normalized) -> PhotoCategory.MASTRO_ANTENA
      Regex("""\bcaixa\b""").containsMatchIn(normalized) -> PhotoCategory.CAIXA_FUNDO_MADEIRA
      else -> return null
    }
    val time = """(\d{1,2}:\d{2}(?::\d{2})?)"""
    val range = Regex("""(?:de|das|entre)\s+$time\s+(?:ate|as|a|e)\s+$time""").find(normalized)
      ?: Regex("""$time\s+(?:ate|as|a|e)\s+$time""").find(normalized)
    if (range != null) {
      return CategoryWindowCommand(category, range.groupValues[1], range.groupValues[2], missingEnd = false)
    }
    val startOnly = Regex("""(?:de|das|a partir de)\s+$time""").find(normalized)
      ?: Regex("""$time""").find(normalized)
    return startOnly?.let { CategoryWindowCommand(category, it.groupValues[1], null, missingEnd = true) }
  }

  fun matchPhotosByTimeWindow(
    photos: List<PhotoMetadata>,
    visitDate: LocalDate?,
    startText: String,
    endText: String,
    zone: ZoneId = ZoneId.systemDefault()
  ): TimeWindowMatch {
    val start = parseTimeInput(startText) ?: return TimeWindowMatch(emptyList(), photos.filter { it.bestInstant() == null }, false, "invalid_start_time")
    val end = parseTimeInput(endText) ?: return TimeWindowMatch(emptyList(), photos.filter { it.bestInstant() == null }, false, "invalid_end_time")
    if (start.time > end.time) return TimeWindowMatch(emptyList(), photos.filter { it.bestInstant() == null }, false, "invalid_time_range")
    val selected = photos.filter { photo ->
      val instant = photo.bestInstant() ?: return@filter false
      val local = instant.atZone(zone)
      val dateOk = visitDate == null || local.toLocalDate() == visitDate
      val time = local.toLocalTime()
      dateOk && !time.isBefore(start.time) && if (end.hasSeconds) !time.isAfter(end.time) else time <= end.time.withSecond(59).withNano(999_999_999)
    }
    return TimeWindowMatch(selected, photos.filter { it.bestInstant() == null }, true, null)
  }

  fun buildReview(
    photos: List<PhotoMetadata>,
    visitDate: LocalDate?,
    windows: Map<PhotoCategory, CategoryTimeWindow>,
    zone: ZoneId = ZoneId.systemDefault()
  ): TimeWindowReview {
    val entries = windows.mapValues { (_, window) ->
      val match = matchPhotosByTimeWindow(photos, visitDate, window.startTime, window.endTime, zone)
      val automaticUris = match.photos.map { it.uri.toString() }.toSet()
      val excluded = window.manuallyExcludedPhotoIds
      val included = window.manuallyIncludedPhotoIds
      (automaticUris - excluded + included).toSet()
    }
    val owners = mutableMapOf<String, MutableList<PhotoCategory>>()
    entries.forEach { (category, uris) ->
      uris.forEach { uri -> owners.getOrPut(uri) { mutableListOf() }.add(category) }
    }
    val conflicts = owners.filterValues { it.size > 1 }.map { (uri, categories) -> TimeWindowConflict(uri, categories) }
    return TimeWindowReview(entries, conflicts)
  }

  fun validateWindows(photos: List<PhotoMetadata>, visitDate: LocalDate?, windows: Map<PhotoCategory, CategoryTimeWindow>): TimelineValidationResult {
    if (photos.isEmpty()) return TimelineValidationResult(false, "Nenhuma foto encontrada para organizar.")
    val missing = categories.firstOrNull { windows[it] == null }
    if (missing != null) return TimelineValidationResult(false, "${TimelineOrganizer.label(missing)} ainda precisa de janela temporal.")
    val invalid = windows.values.firstOrNull {
      parseTimeInput(it.startTime) == null || parseTimeInput(it.endTime) == null || (parseTimeInput(it.startTime)!!.time > parseTimeInput(it.endTime)!!.time)
    }
    if (invalid != null) return TimelineValidationResult(false, "Janela inválida em ${TimelineOrganizer.label(invalid.category)}.")
    val review = buildReview(photos, visitDate, windows)
    if (review.conflicts.isNotEmpty()) return TimelineValidationResult(false, "Conflito de janela: uma ou mais fotos caem em categorias sobrepostas.")
    return TimelineValidationResult(true, "Janelas válidas.")
  }

  fun distribute(
    photos: List<PhotoMetadata>,
    visitDate: LocalDate?,
    windows: Map<PhotoCategory, CategoryTimeWindow>,
    zone: ZoneId = ZoneId.systemDefault()
  ): List<ClassifiedPhoto> {
    val validation = validateWindows(photos, visitDate, windows)
    require(validation.ok) { validation.message }
    val byUri = photos.associateBy { it.uri.toString() }
    val review = buildReview(photos, visitDate, windows, zone)
    return TimeWindowOrganizer.categories.flatMap { category ->
      review.categoryPhotoIds[category].orEmpty()
        .mapNotNull { byUri[it] }
        .sortedBy { it.bestInstant() ?: Instant.EPOCH }
        .map { photo ->
          ClassifiedPhoto(
            metadata = photo,
            category = category,
            confidence = 1.0,
            reason = "time_window_v2",
            source = PhotoBridgeMode.SGTO_FAST_TIMELINE.name
          )
        }
    }
  }

  private fun normalize(value: String): String {
    return java.text.Normalizer.normalize(value.lowercase(), java.text.Normalizer.Form.NFD)
      .replace("\\p{Mn}+".toRegex(), "")
      .replace("às", "as")
      .replace("\\s+".toRegex(), " ")
      .trim()
  }
}

data class TimeWindowBoundary(val time: LocalTime, val hasSeconds: Boolean)
data class CategoryWindowCommand(val category: PhotoCategory, val startTime: String, val endTime: String?, val missingEnd: Boolean)
data class TimeWindowMatch(val photos: List<PhotoMetadata>, val photosWithoutTimestamp: List<PhotoMetadata>, val ok: Boolean, val error: String?)
data class CategoryTimeWindow(
  val category: PhotoCategory,
  val startTime: String,
  val endTime: String,
  val precision: String,
  val manuallyIncludedPhotoIds: Set<String> = emptySet(),
  val manuallyExcludedPhotoIds: Set<String> = emptySet(),
  val reviewStatus: String = "PENDING"
)
data class TimeWindowConflict(val photoId: String, val categories: List<PhotoCategory>)
data class TimeWindowReview(val categoryPhotoIds: Map<PhotoCategory, Set<String>>, val conflicts: List<TimeWindowConflict>)
