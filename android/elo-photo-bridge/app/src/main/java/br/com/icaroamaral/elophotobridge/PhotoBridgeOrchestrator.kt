package br.com.icaroamaral.elophotobridge

import android.util.Log
import java.text.Normalizer
import java.time.Instant
import java.time.ZoneId
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.coroutineContext

class PhotoBridgeOrchestrator(
  private val repository: PhotoRepository,
  private val cityResolver: suspend (PhotoMetadata) -> PhotoMetadata,
  private val config: BridgeConfig = BridgeConfig(),
  private val parser: CommandParser = CommandParser(),
  private val grouper: VisitGrouper = VisitGrouper(config),
  private val adapter: EloPhotoBridgeAdapter = EloPhotoBridgeAdapter(),
  private val visualClassifier: VisualPhotoCategoryClassifier? = null
) {
  suspend fun run(
    commandText: String,
    onProgress: suspend (PhotoBridgeProgress) -> Unit = {}
  ): Result<String> {
    return try {
      val (command, groups) = findVisitGroups(commandText, onProgress).getOrThrow()
      if (!command.latestVisit && groups.size > 1) return Result.failure(VisitSelectionRequiredException(command, groups))
      val group = selectGroup(command, groups)
      Result.success(preparePayloadForGroup(command, group, onProgress))
    } catch (error: CancellationException) {
      throw error
    } catch (error: Exception) {
      Result.failure(error)
    }
  }

  suspend fun findVisitGroups(
    commandText: String,
    onProgress: suspend (PhotoBridgeProgress) -> Unit = {}
  ): Result<Pair<ParsedCommand, List<VisitGroup>>> {
    return try {
      val command = parser.parse(commandText)
      val invalidTime = UserVisitWindowFilter.hasInvalidTimeRange(commandText)
      val window = UserVisitWindowFilter.fromText(command, commandText)
      SelectionDiagnosticStore.start(commandText, command, window, invalidTime)
      if (invalidTime) throw IllegalArgumentException("invalid_time")
      val requestedDate = window?.date ?: command.dateHint ?: return Result.failure(IllegalStateException("date_required"))
      val displayDate = requestedDate.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"))
      onProgress(PhotoBridgeProgress(PhotoBridgeFlowStatus.SEARCHING_PHOTOS, "Procurando fotos de $displayDate..."))

      val datePhotos = repository.photosForDate(requestedDate, ZoneId.systemDefault())
      Log.d(TAG, "MEDIASTORE_TOTAL_MATCHES_DATE: ${datePhotos.size}")
      Log.d(TAG, "PHOTOS_AFTER_DATE_FILTER: ${datePhotos.size}")
      Log.d(TAG, "TIMESTAMP_SOURCE_COUNTS: ${timestampSourceCounts(datePhotos)}")
      coroutineContext.ensureActive()
      onProgress(PhotoBridgeProgress(PhotoBridgeFlowStatus.READING_METADATA, "Encontradas ${datePhotos.size} fotos em $displayDate.", datePhotos.size, datePhotos.size, datePhotos.size))

      val timeFilteredPhotos = if (window != null) {
        Log.d(TAG, "UI_START_TIME_RAW: ${window.rawStartTime}")
        Log.d(TAG, "UI_END_TIME_RAW: ${window.rawEndTime}")
        Log.d(TAG, "TIME_FILTER_START: ${window.startTime}")
        Log.d(TAG, "TIME_FILTER_END: ${window.endTime}")
        UserVisitWindowFilter.filterPhotosByUserWindow(datePhotos, window.date, window.startTime, window.endTime)
      } else {
        datePhotos
      }
      Log.d(TAG, "PHOTOS_AFTER_TIME_FILTER: ${timeFilteredPhotos.size}")

      if (datePhotos.isEmpty()) return Result.failure(IllegalStateException("photos_not_found_for_date"))
      if (window != null && timeFilteredPhotos.isEmpty()) return Result.failure(IllegalStateException("photos_not_found_for_window"))

      Log.d(TAG, "CITY_INPUT_PHOTOS: ${timeFilteredPhotos.size}")
      val resolvedPhotos = resolveCities(timeFilteredPhotos, onProgress)
      if (window != null && resolvedPhotos.size > timeFilteredPhotos.size) {
        Log.e(TAG, "CITY_INPUT_INVARIANT_FAILED: cityInput=${resolvedPhotos.size} timeWindow=${timeFilteredPhotos.size}")
        throw IllegalStateException("city_input_invariant_failed")
      }

      val cityHint = window?.cityHint ?: command.cityHint
      val cityFilteredPhotos = if (cityHint.isNullOrBlank()) {
        resolvedPhotos
      } else {
        resolvedPhotos.filter { VisitRefinementParser.cityMatches(it.city, cityHint) }
      }
      Log.d(TAG, "PHOTOS_AFTER_CITY_HINT: ${cityFilteredPhotos.size}")

      if (window != null && cityFilteredPhotos.size > timeFilteredPhotos.size) {
        throw IllegalStateException("no_expansion_invariant_failed")
      }
      if (cityFilteredPhotos.isEmpty()) return Result.failure(IllegalStateException("visit_not_found"))

      val groups = if (window != null) {
        Log.d(TAG, "VISITGROUPER_BYPASS: true")
        listOf(userDefinedGroup(window, cityFilteredPhotos))
      } else {
        Log.d(TAG, "VISITGROUPER_BYPASS: false")
        withContext(Dispatchers.Default) {
          coroutineContext.ensureActive()
          onProgress(PhotoBridgeProgress(PhotoBridgeFlowStatus.GROUPING_VISIT, "Agrupando fotos da mesma visita...", photoCount = cityFilteredPhotos.size))
          grouper.group(cityFilteredPhotos)
        }
      }
      if (groups.isEmpty()) return Result.failure(IllegalStateException("visit_not_found"))
      val selected = selectGroup(command, groups)
      if (window != null && selected.photos.size > timeFilteredPhotos.size) {
        Log.e(TAG, "NO_EXPANSION_INVARIANT_FAILED: selected=${selected.photos.size} timeWindow=${timeFilteredPhotos.size}")
        throw IllegalStateException("no_expansion_invariant_failed")
      }
      SelectionDiagnosticStore.recordFilterPipeline(
        datePhotos = datePhotos,
        timeWindowPhotos = timeFilteredPhotos,
        cityPhotos = cityFilteredPhotos,
        selectedPhotos = selected.photos,
        cityInputPhotos = resolvedPhotos.size,
        visitGrouperBypass = window != null,
        windowFilterCalled = window != null
      )
      Log.d(TAG, "NO_EXPANSION_INVARIANT: PASS selected=${selected.photos.size} timeWindow=${timeFilteredPhotos.size}")
      Log.d(TAG, "SELECTED_VISIT_PHOTOS: ${selected.photos.size}")
      Result.success(command to groups)
    } catch (error: CancellationException) {
      throw error
    } catch (error: Exception) {
      Result.failure(error)
    }
  }

  suspend fun prepareFastTimelinePayloadForGroup(
    command: ParsedCommand,
    group: VisitGroup,
    cuts: Map<PhotoCategory, Int>,
    manualCategories: Map<String, PhotoCategory> = emptyMap(),
    onProgress: suspend (PhotoBridgeProgress) -> Unit = {}
  ): String {
    Log.d(TAG, "PHOTOS_SENT_TO_TIMELINE: ${group.photos.size}")
    Log.d(TAG, "PHOTOS_SENT_TO_AI: 0")
    SelectionDiagnosticStore.recordTimelineSend(group.photos.size)
    return withContext(Dispatchers.Default) {
      coroutineContext.ensureActive()
      onProgress(PhotoBridgeProgress(PhotoBridgeFlowStatus.PREPARING_REPORT, "Organizando fotos por timeline...", photoCount = group.photos.size))
      val classified = TimelineOrganizer.distribute(group.photos, cuts, manualCategories)
      val built = adapter.buildPayload(command, group, classified)
      onProgress(PhotoBridgeProgress(PhotoBridgeFlowStatus.CLASSIFICATION_REVIEW, "Organizacao rapida pronta para revisao.", photoCount = group.photos.size, categoryCounts = built.photos.mapKeys { it.key.name.lowercase() }.mapValues { it.value.size }))
      adapter.toJson(built)
    }
  }

  suspend fun preparePayloadForGroup(
    command: ParsedCommand,
    group: VisitGroup,
    onProgress: suspend (PhotoBridgeProgress) -> Unit = {}
  ): String {
    val classified = classifyPhotos(group.photos, onProgress)
    return withContext(Dispatchers.Default) {
      coroutineContext.ensureActive()
      onProgress(PhotoBridgeProgress(PhotoBridgeFlowStatus.PREPARING_REPORT, "Preparando resumo para revisao...", photoCount = group.photos.size))
      val built = adapter.buildPayload(command, group, classified)
      onProgress(PhotoBridgeProgress(PhotoBridgeFlowStatus.CLASSIFICATION_REVIEW, "Classificacao pronta para revisao.", photoCount = group.photos.size, categoryCounts = built.photos.mapKeys { it.key.name.lowercase() }.mapValues { it.value.size }))
      adapter.toJson(built)
    }
  }

  private suspend fun resolveCities(photos: List<PhotoMetadata>, onProgress: suspend (PhotoBridgeProgress) -> Unit): List<PhotoMetadata> {
    return withContext(Dispatchers.IO) {
      photos.mapIndexed { index, photo ->
        coroutineContext.ensureActive()
        onProgress(PhotoBridgeProgress(PhotoBridgeFlowStatus.RESOLVING_LOCATION, "Identificando cidade - ${index + 1} de ${photos.size}", index + 1, photos.size, photos.size))
        withTimeoutOrNull(GEOCODER_TIMEOUT_MS) { cityResolver(photo) } ?: photo.copy(city = photo.city)
      }
    }
  }

  private suspend fun classifyPhotos(photos: List<PhotoMetadata>, onProgress: suspend (PhotoBridgeProgress) -> Unit): List<ClassifiedPhoto> {
    Log.d(TAG, "PHOTOS_SENT_TO_AI: ${photos.size}")
    SelectionDiagnosticStore.recordAiSend(photos.size)
    val counts = mutableMapOf<String, Int>()
    return photos.mapIndexed { index, photo ->
      coroutineContext.ensureActive()
      onProgress(PhotoBridgeProgress(PhotoBridgeFlowStatus.CLASSIFYING_PHOTOS, "Classificando fotos - ${index + 1} de ${photos.size}", index + 1, photos.size, photos.size, counts.toMap()))
      val result = withTimeoutOrNull(config.visualClassificationTimeoutMs + 1500L) {
        visualClassifier?.classify(photo)
      } ?: PhotoClassificationResult(PhotoCategory.UNKNOWN, 0.0, "classification_timeout", "timeout")
      val classified = ClassifiedPhoto(photo, result.category, result.confidence, result.reason, result.source)
      counts[classified.category.name.lowercase()] = (counts[classified.category.name.lowercase()] ?: 0) + 1
      classified
    }
  }

  private fun userDefinedGroup(window: UserVisitWindowRequest, photos: List<PhotoMetadata>): VisitGroup {
    val city = photos.groupingBy { it.city ?: "UNKNOWN" }.eachCount().maxByOrNull { it.value }?.key ?: window.cityHint ?: "UNKNOWN"
    return VisitGroup(city = city, date = window.date, photos = photos.sortedBy { it.bestInstant() ?: Instant.EPOCH }, confidenceCity = if (city == "UNKNOWN") 0.0 else 1.0, confidenceDate = 1.0)
  }

  private fun selectGroup(command: ParsedCommand, groups: List<VisitGroup>): VisitGroup {
    return if (command.latestVisit) groups.maxBy { it.photos.maxOf { photo -> photo.bestInstant() ?: Instant.EPOCH } } else groups.first()
  }

  private fun timestampSourceCounts(photos: List<PhotoMetadata>): String {
    return photos.groupingBy { it.timestampSourceName() }.eachCount().toSortedMap().entries.joinToString(",") { "${it.key}=${it.value}" }
  }

  private fun normalize(value: String?): String {
    return Normalizer.normalize((value ?: "").lowercase(), Normalizer.Form.NFD)
      .replace("\\p{Mn}+".toRegex(), "")
      .replace("\\s+".toRegex(), " ")
      .trim()
  }

  companion object {
    private const val GEOCODER_TIMEOUT_MS = 2500L
    private const val TAG = "EloPhotoBridge"
  }
}