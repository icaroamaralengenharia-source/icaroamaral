package br.com.icaroamaral.elophotobridge

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

interface PhotoRepository {
  suspend fun recentPhotos(since: Instant): List<PhotoMetadata>

  suspend fun photosForDate(date: LocalDate, zone: ZoneId = ZoneId.systemDefault()): List<PhotoMetadata> {
    val start = date.atStartOfDay(zone).toInstant()
    val end = date.plusDays(1).atStartOfDay(zone).toInstant()
    return recentPhotos(start).filter { photo ->
      val instant = photo.bestInstant() ?: return@filter false
      !instant.isBefore(start) && instant.isBefore(end)
    }
  }
}
