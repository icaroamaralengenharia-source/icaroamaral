package br.com.icaroamaral.elophotobridge

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

object SelectionDiagnosticStore {
  private val sampleFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
  @Volatile private var snapshot: SelectionDiagnosticSnapshot = SelectionDiagnosticSnapshot()

  fun start(commandText: String, command: ParsedCommand, window: UserVisitWindowRequest?, invalidTime: Boolean) {
    val refinement = VisitRefinementParser().parse(commandText)
    val date = window?.date ?: refinement.date ?: command.dateHint
    snapshot = SelectionDiagnosticSnapshot(
      commandText = commandText.take(500),
      dateRaw = date?.toString().orEmpty(),
      startTimeRaw = window?.rawStartTime ?: refinement.rawStartTime.orEmpty(),
      endTimeRaw = window?.rawEndTime ?: refinement.rawEndTime.orEmpty(),
      parsedStart = window?.startTime?.toString().orEmpty(),
      parsedEnd = window?.endTime?.toString().orEmpty(),
      timezone = ZoneId.systemDefault().id,
      completeWindowInformed = date != null && (window != null || invalidTime),
      invalidTime = invalidTime
    )
  }

  fun recordFilterPipeline(
    datePhotos: List<PhotoMetadata>,
    timeWindowPhotos: List<PhotoMetadata>,
    cityPhotos: List<PhotoMetadata>,
    selectedPhotos: List<PhotoMetadata>,
    visitGrouperBypass: Boolean,
    windowFilterCalled: Boolean,
    cityInputPhotos: Int,
    photosSentToTimeline: Int? = null,
    photosSentToAi: Int? = null,
    zone: ZoneId = ZoneId.systemDefault()
  ) {
    val timeWindowIds = timeWindowPhotos.map { it.uri.toString() }.toSet()
    snapshot = snapshot.copy(
      windowFilterCalled = windowFilterCalled,
      mediaStoreTotalDate = datePhotos.size,
      photosAfterDate = datePhotos.size,
      photosAfterTime = timeWindowPhotos.size,
      photosAfterCity = cityPhotos.size,
      cityInputPhotos = cityInputPhotos,
      selectedVisitPhotos = selectedPhotos.size,
      photosSentToTimeline = photosSentToTimeline ?: snapshot.photosSentToTimeline,
      photosSentToAi = photosSentToAi ?: snapshot.photosSentToAi,
      visitGrouperBypass = visitGrouperBypass,
      timestampSourceCounts = sourceCounts(datePhotos),
      datePhotoSamples = datePhotos.take(10).map { it.toDiagnosticSample(zone, timeWindowIds.contains(it.uri.toString())) },
      timeWindowSamples = timeWindowPhotos.take(10).map { it.toDiagnosticSample(zone, true) },
      selectedSamples = selectedPhotos.take(10).map { it.toDiagnosticSample(zone, timeWindowIds.contains(it.uri.toString())) }
    )
  }

  fun recordTimelineSend(count: Int) {
    snapshot = snapshot.copy(photosSentToTimeline = count, photosSentToAi = 0)
  }

  fun recordAiSend(count: Int) {
    snapshot = snapshot.copy(photosSentToAi = count)
  }

  fun current(): SelectionDiagnosticSnapshot = snapshot

  fun compactText(): String = snapshot.toDiagnosticText()

  private fun sourceCounts(photos: List<PhotoMetadata>): Map<PhotoTimestampSource, Int> {
    return PhotoTimestampSource.values().associateWith { source -> photos.count { it.bestTimestamp()?.source == source } }
  }

  private fun PhotoMetadata.toDiagnosticSample(zone: ZoneId, insideWindow: Boolean): SelectionDiagnosticPhotoSample {
    val timestamp = bestTimestamp()
    val local = timestamp?.instant?.atZone(zone)?.toLocalDateTime()
    return SelectionDiagnosticPhotoSample(
      idOrName = displayName.ifBlank { uri.toString().takeLast(80) }.take(120),
      timestampSource = timestamp?.source?.name ?: "UNKNOWN",
      timestampRaw = timestamp?.raw.orEmpty().take(120),
      timestampLocal = local?.format(sampleFormat).orEmpty(),
      insideWindow = insideWindow,
      city = city.orEmpty().take(80)
    )
  }
}

data class SelectionDiagnosticSnapshot(
  val commandText: String = "",
  val dateRaw: String = "",
  val startTimeRaw: String = "",
  val endTimeRaw: String = "",
  val parsedStart: String = "",
  val parsedEnd: String = "",
  val timezone: String = "",
  val completeWindowInformed: Boolean = false,
  val invalidTime: Boolean = false,
  val windowFilterCalled: Boolean = false,
  val mediaStoreTotalDate: Int = 0,
  val photosAfterDate: Int = 0,
  val photosAfterTime: Int = 0,
  val photosAfterCity: Int = 0,
  val cityInputPhotos: Int = 0,
  val selectedVisitPhotos: Int = 0,
  val photosSentToTimeline: Int = 0,
  val photosSentToAi: Int = 0,
  val visitGrouperBypass: Boolean = false,
  val timestampSourceCounts: Map<PhotoTimestampSource, Int> = emptyMap(),
  val datePhotoSamples: List<SelectionDiagnosticPhotoSample> = emptyList(),
  val timeWindowSamples: List<SelectionDiagnosticPhotoSample> = emptyList(),
  val selectedSamples: List<SelectionDiagnosticPhotoSample> = emptyList()
) {
  val expandedAfterFilter: Boolean get() = selectedVisitPhotos > photosAfterTime
  val filterNotCalledWithCompleteWindow: Boolean get() = completeWindowInformed && !windowFilterCalled
  val timeFilterDidNotReduce: Boolean get() = photosAfterDate == 210 && photosAfterTime == 210
  val cityFilterZeroedWindow: Boolean get() = photosAfterTime > 0 && photosAfterCity == 0
  val visitGrouperUsedWithCompleteWindow: Boolean get() = completeWindowInformed && !visitGrouperBypass

  fun toDiagnosticText(): String {
    return buildString {
      appendLine("DATE_RAW=$dateRaw")
      appendLine("START_RAW=$startTimeRaw")
      appendLine("END_RAW=$endTimeRaw")
      appendLine("START_PARSED=$parsedStart")
      appendLine("END_PARSED=$parsedEnd")
      appendLine("TIMEZONE=$timezone")
      appendLine("WINDOW_FILTER_CALLED=$windowFilterCalled")
      appendLine("AFTER_DATE=$photosAfterDate")
      appendLine("AFTER_TIME=$photosAfterTime")
      appendLine("AFTER_CITY=$photosAfterCity")
      appendLine("CITY_INPUT=$cityInputPhotos")
      appendLine("SELECTED=$selectedVisitPhotos")
      appendLine("VISITGROUPER_BYPASS=$visitGrouperBypass")
      appendLine("EXPANDED_AFTER_FILTER=$expandedAfterFilter")
      appendLine("SENT_TIMELINE=$photosSentToTimeline")
      appendLine("SENT_AI=$photosSentToAi")
      appendLine()
      appendLine("TIMESTAMP_SOURCE_COUNTS:")
      appendLine("EXIF_DATETIME_ORIGINAL=${count(PhotoTimestampSource.EXIF_DATETIME_ORIGINAL)}")
      appendLine("MEDIASTORE_DATE_TAKEN=${count(PhotoTimestampSource.MEDIASTORE_DATE_TAKEN)}")
      appendLine("EXIF_DATETIME_DIGITIZED=${count(PhotoTimestampSource.EXIF_DATETIME_DIGITIZED)}")
      appendLine("MEDIASTORE_DATE_MODIFIED=${count(PhotoTimestampSource.MEDIASTORE_DATE_MODIFIED)}")
      appendLine("MEDIASTORE_DATE_ADDED=${count(PhotoTimestampSource.MEDIASTORE_DATE_ADDED)}")
      appendLine("UNKNOWN=${unknownTimestampCount()}")
      appendSamples("SAMPLE_DATE", datePhotoSamples)
      appendSamples("SAMPLE_TIME", timeWindowSamples)
      appendSamples("SAMPLE_SELECTED", selectedSamples)
      if (filterNotCalledWithCompleteWindow) appendLine("ERRO=JANELA COMPLETA INFORMADA, MAS FILTRO HORARIO NAO FOI EXECUTADO")
      if (timeFilterDidNotReduce) appendLine("ALERTA=FILTRO HORARIO NAO REDUZIU O CONJUNTO")
      if (expandedAfterFilter) appendLine("ERRO=CONJUNTO FOI EXPANDIDO APOS O FILTRO HORARIO")
      if (visitGrouperUsedWithCompleteWindow) appendLine("ERRO=VISITGROUPER FOI USADO COM JANELA COMPLETA")
      if (cityFilterZeroedWindow) appendLine("ALERTA=FILTRO DE CIDADE ZEROU A JANELA")
      if (invalidTime) appendLine("ERRO=HORARIO INVALIDO")
    }
  }

  private fun count(source: PhotoTimestampSource): Int = timestampSourceCounts[source] ?: 0
  private fun unknownTimestampCount(): Int = (photosAfterDate - timestampSourceCounts.values.sum()).coerceAtLeast(0)

  private fun StringBuilder.appendSamples(title: String, samples: List<SelectionDiagnosticPhotoSample>) {
    appendLine()
    appendLine("$title:")
    if (samples.isEmpty()) {
      appendLine("EMPTY")
      return
    }
    samples.forEachIndexed { index, sample -> appendLine("${index + 1}. ${sample.compactLine()}") }
  }
}

data class SelectionDiagnosticPhotoSample(
  val idOrName: String,
  val timestampSource: String,
  val timestampRaw: String,
  val timestampLocal: String,
  val insideWindow: Boolean,
  val city: String
) {
  fun compactLine(): String {
    return "ID=$idOrName | SOURCE=$timestampSource | RAW=$timestampRaw | LOCAL=$timestampLocal | IN_WINDOW=${if (insideWindow) "SIM" else "NAO"} | CITY=$city"
  }
}