package br.com.icaroamaral.elophotobridge

import android.net.Uri
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UserVisitWindowSelectionTest {
  @Test
  fun commandParserKeepsUserLocalTimeWindow() {
    val command = CommandParser().parse("monte o SGTO de Malhada de Pedras do dia 28/08/2026 das 15:40 às 16:10")

    assertEquals(LocalDate.of(2026, 8, 28), command.dateHint)
    assertEquals(LocalTime.of(15, 40), command.startTimeHint)
    assertEquals(LocalTime.of(16, 10), command.endTimeHint)
    assertEquals("Malhada de Pedras", command.cityHint)
  }

  @Test
  fun userDateAndTimeWindowSelectsVisitWithoutCityOrGrouperRejection() = runBlocking {
    val zone = ZoneId.systemDefault()
    val date = LocalDate.of(2026, 8, 28)
    val photos = buildControlledFixture(date, zone)
    val repository = object : PhotoRepository {
      override suspend fun recentPhotos(since: Instant): List<PhotoMetadata> = photos
      override suspend fun photosForDate(date: LocalDate, zone: ZoneId): List<PhotoMetadata> = photos
    }
    val orchestrator = PhotoBridgeOrchestrator(
      repository = repository,
      cityResolver = { it }
    )

    val result = orchestrator.findVisitGroups("monte o SGTO de Malhada de Pedras do dia 28/08/2026 das 15:40 às 16:10")

    assertTrue(result.exceptionOrNull()?.message.orEmpty(), result.isSuccess)
    val groups = result.getOrThrow().second
    assertEquals(1, groups.size)
    assertEquals(20, groups.first().photos.size)
    val diagnostic = SelectionDiagnosticStore.current()
    assertEquals(100, diagnostic.photosAfterDate)
    assertEquals(20, diagnostic.photosAfterTime)
    assertEquals(20, diagnostic.photosAfterCity)
    assertEquals(20, diagnostic.selectedVisitPhotos)
    assertTrue(diagnostic.visitGrouperBypass)
    assertFalse(diagnostic.visitGrouperUsedWithCompleteWindow)
    assertFalse(diagnostic.cityFilterZeroedWindow)
  }

  @Test
  fun cityHintAllowsPartialMatchesAndUnknown() {
    assertTrue(VisitRefinementParser.cityMatches("Malhada de Pedras", "malhada"))
    assertTrue(VisitRefinementParser.cityMatches(null, "malhada"))
    assertTrue(VisitRefinementParser.cityMatches("UNKNOWN", "malhada"))
  }

  private fun buildControlledFixture(date: LocalDate, zone: ZoneId): List<PhotoMetadata> {
    val insideWindow = (0 until 20).map { index ->
      val time = LocalTime.of(15, 40).plusMinutes(index.toLong())
      photo(index, date.atTime(time).atZone(zone).toInstant(), if (index % 2 == 0) "Malhada de Pedras" else null)
    }
    val outsideWindow = (20 until 100).map { index ->
      val hour = if (index < 60) 10 else 18
      val minute = index % 40
      photo(index, LocalDateTime.of(date, LocalTime.of(hour, minute)).atZone(zone).toInstant(), "Outra Cidade")
    }
    return insideWindow + outsideWindow
  }

  private fun photo(index: Int, instant: Instant, city: String?): PhotoMetadata {
    val rawDateTaken = instant.toEpochMilli()
    return PhotoMetadata(
      uri = FakeUri("content://fixture/photo/$index"),
      displayName = "photo_$index.jpg",
      dateTaken = instant,
      dateAdded = null,
      exifDateOriginal = null,
      width = 100,
      height = 100,
      mimeType = "image/jpeg",
      latitude = null,
      longitude = null,
      city = city,
      dateTakenRaw = rawDateTaken
    )
  }

  private class FakeUri(private val value: String) : Uri() {
    override fun isHierarchical(): Boolean = true
    override fun getScheme(): String = "content"
    override fun getSchemeSpecificPart(): String = value.removePrefix("content:")
    override fun getEncodedSchemeSpecificPart(): String = schemeSpecificPart
    override fun getAuthority(): String = "fixture"
    override fun getEncodedAuthority(): String = authority
    override fun getUserInfo(): String? = null
    override fun getEncodedUserInfo(): String? = null
    override fun getHost(): String = "fixture"
    override fun getPort(): Int = -1
    override fun getPath(): String = value.removePrefix("content://fixture")
    override fun getEncodedPath(): String = path
    override fun getQuery(): String? = null
    override fun getEncodedQuery(): String? = null
    override fun getFragment(): String? = null
    override fun getEncodedFragment(): String? = null
    override fun getPathSegments(): List<String> = path.trim('/').split('/').filter(String::isNotBlank)
    override fun getLastPathSegment(): String? = pathSegments.lastOrNull()
    override fun buildUpon(): Builder = Builder().scheme("content").authority("fixture").path(path)
    override fun toString(): String = value
  }
}
