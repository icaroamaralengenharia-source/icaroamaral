package br.com.icaroamaral.elophotobridge

import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

object UserVisitWindowFilter {
  fun fromText(command: ParsedCommand, inputText: String): UserVisitWindowRequest? {
    val refinement = VisitRefinementParser().parse(inputText)
    val date = refinement.date ?: command.dateHint ?: return null
    val start = refinement.startTime ?: return null
    val end = refinement.endTime ?: return null
    return UserVisitWindowRequest(
      date = date,
      startTime = start,
      endTime = end,
      cityHint = refinement.cityHint ?: command.cityHint
    )
  }

  fun filterPhotosByUserWindow(
    photos: List<PhotoMetadata>,
    date: LocalDate,
    startTime: LocalTime,
    endTime: LocalTime,
    zone: ZoneId = ZoneId.systemDefault()
  ): List<PhotoMetadata> {
    val inclusiveEnd = if (endTime.second == 0 && endTime.nano == 0) endTime.withSecond(59) else endTime
    return photos.filter { photo ->
      val local = photo.bestInstant()?.atZone(zone)?.toLocalDateTime() ?: return@filter false
      local.toLocalDate() == date &&
        !local.toLocalTime().isBefore(startTime) &&
        !local.toLocalTime().isAfter(inclusiveEnd)
    }
  }
}

data class UserVisitWindowRequest(
  val date: LocalDate,
  val startTime: LocalTime,
  val endTime: LocalTime,
  val cityHint: String?
)
