package br.com.icaroamaral.elophotobridge

import android.util.Log
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

object UserVisitWindowFilter {
  private const val TAG = "EloPhotoBridge"
  private val LOG_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS")

  fun fromText(command: ParsedCommand, inputText: String): UserVisitWindowRequest? {
    val refinement = VisitRefinementParser().parse(inputText)
    val date = command.dateHint ?: refinement.date ?: return null
    val start = command.startTimeHint ?: refinement.startTime ?: return null
    val end = command.endTimeHint ?: refinement.endTime ?: return null
    val endHasSeconds = command.endTimeHasSeconds || refinement.endHasSeconds
    return UserVisitWindowRequest(
      date = date,
      startTime = normalizeStart(start),
      endTime = normalizeEnd(end, endHasSeconds),
      cityHint = refinement.cityHint ?: command.cityHint,
      rawStartTime = command.rawStartTimeHint ?: refinement.rawStartTime ?: start.toString(),
      rawEndTime = command.rawEndTimeHint ?: refinement.rawEndTime ?: end.toString(),
      endHasSeconds = endHasSeconds
    )
  }

  fun hasInvalidTimeRange(inputText: String): Boolean = VisitRefinementParser().parse(inputText).timeRangeInvalid

  fun filterPhotosByUserWindow(
    photos: List<PhotoMetadata>,
    date: LocalDate,
    startTime: LocalTime,
    endTime: LocalTime,
    zone: ZoneId = ZoneId.systemDefault()
  ): List<PhotoMetadata> {
    Log.d(TAG, "WINDOW_FILTER_CALLED: true")
    Log.d(TAG, "PARSED_START: $startTime")
    Log.d(TAG, "PARSED_END: $endTime")
    return photos.filter { photo ->
      val timestamp = photo.bestTimestamp()
      if (timestamp == null) {
        Log.d(TAG, "TIMESTAMP_SOURCE: NONE | URI: ${photo.uri}")
        return@filter false
      }
      val local = timestamp.instant.atZone(zone).toLocalDateTime()
      Log.d(TAG, "TIMESTAMP_SOURCE: ${timestamp.source.name} | TIMESTAMP_RAW: ${timestamp.raw} | TIMESTAMP_LOCAL: ${local.format(LOG_FORMAT)} | URI: ${photo.uri}")
      local.toLocalDate() == date &&
        !local.toLocalTime().isBefore(startTime) &&
        !local.toLocalTime().isAfter(endTime)
    }
  }

  private fun normalizeStart(startTime: LocalTime): LocalTime = startTime.withNano(0)

  private fun normalizeEnd(endTime: LocalTime, endHasSeconds: Boolean): LocalTime {
    return if (endHasSeconds) {
      endTime.withNano(999_999_999)
    } else {
      endTime.withSecond(59).withNano(999_999_999)
    }
  }
}

data class UserVisitWindowRequest(
  val date: LocalDate,
  val startTime: LocalTime,
  val endTime: LocalTime,
  val cityHint: String?,
  val rawStartTime: String,
  val rawEndTime: String,
  val endHasSeconds: Boolean
)
