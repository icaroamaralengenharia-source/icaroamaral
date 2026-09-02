package br.com.icaroamaral.elophotobridge

import java.time.Duration
import java.time.ZoneId

class VisitGrouper(private val config: BridgeConfig = BridgeConfig()) {
  fun group(photos: List<PhotoMetadata>): List<VisitGroup> {
    val zone = ZoneId.systemDefault()
    val ordered = photos
      .filter { it.bestInstant() != null }
      .sortedBy { it.bestInstant() }

    val groups = mutableListOf<MutableList<PhotoMetadata>>()
    for (photo in ordered) {
      val previousGroup = groups.lastOrNull()
      val previous = previousGroup?.lastOrNull()
      val sameCity = normalize(previous?.city) == normalize(photo.city)
      val minutes = if (previous?.bestInstant() != null && photo.bestInstant() != null) {
        Duration.between(previous.bestInstant(), photo.bestInstant()).abs().toMinutes()
      } else {
        Long.MAX_VALUE
      }
      if (previousGroup != null && sameCity && minutes <= config.visitWindowMinutes) {
        previousGroup.add(photo)
      } else {
        groups.add(mutableListOf(photo))
      }
    }

    return groups.map { items ->
      val cities = items.mapNotNull { it.city?.takeIf(String::isNotBlank) }
      val date = items.mapNotNull { it.bestInstant()?.atZone(zone)?.toLocalDate() }.groupingBy { it }.eachCount().maxByOrNull { it.value }?.key
      val city = cities.groupingBy { normalize(it) }.eachCount().maxByOrNull { it.value }?.key
      VisitGroup(
        city = city?.takeUnless { it == "unknown" },
        date = date,
        photos = items,
        confidenceCity = if (items.isEmpty()) 0.0 else cities.size.toDouble() / items.size.toDouble(),
        confidenceDate = if (date == null || items.isEmpty()) 0.0 else items.count { it.bestInstant()?.atZone(zone)?.toLocalDate() == date }.toDouble() / items.size.toDouble()
      )
    }.sortedByDescending { it.photos.size }
  }

  private fun normalize(value: String?): String {
    return value?.lowercase()?.trim()?.replace("\\s+".toRegex(), " ") ?: "unknown"
  }
}
