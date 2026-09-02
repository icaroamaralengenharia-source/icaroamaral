package br.com.icaroamaral.elophotobridge

import android.content.ContentUris
import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.exifinterface.media.ExifInterface
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class MediaStorePhotoRepository(private val context: Context) : PhotoRepository {
  override suspend fun recentPhotos(since: Instant): List<PhotoMetadata> = withContext(Dispatchers.IO) {
    queryPhotos(
      selection = "${MediaStore.Images.Media.DATE_ADDED} >= ?",
      args = arrayOf(since.epochSecond.toString())
    )
  }

  override suspend fun photosForDate(date: LocalDate, zone: ZoneId): List<PhotoMetadata> = withContext(Dispatchers.IO) {
    val start = date.atStartOfDay(zone).toInstant()
    val end = date.plusDays(1).atStartOfDay(zone).toInstant()
    val startMillis = start.toEpochMilli().toString()
    val endMillis = end.minusMillis(1).toEpochMilli().toString()
    val startSeconds = start.epochSecond.toString()
    val endSeconds = end.minusMillis(1).epochSecond.toString()
    queryPhotos(
      selection = "((${MediaStore.Images.Media.DATE_TAKEN} >= ? AND ${MediaStore.Images.Media.DATE_TAKEN} <= ?) OR (${MediaStore.Images.Media.DATE_MODIFIED} >= ? AND ${MediaStore.Images.Media.DATE_MODIFIED} <= ?) OR (${MediaStore.Images.Media.DATE_ADDED} >= ? AND ${MediaStore.Images.Media.DATE_ADDED} <= ?))",
      args = arrayOf(startMillis, endMillis, startSeconds, endSeconds, startSeconds, endSeconds)
    ).filter { photo ->
      val instant = photo.bestInstant() ?: return@filter false
      !instant.isBefore(start) && instant.isBefore(end)
    }
  }

  private fun queryPhotos(selection: String, args: Array<String>): List<PhotoMetadata> {
    val collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
    val projection = arrayOf(
      MediaStore.Images.Media._ID,
      MediaStore.Images.Media.DISPLAY_NAME,
      MediaStore.Images.Media.DATE_TAKEN,
      MediaStore.Images.Media.DATE_ADDED,
      MediaStore.Images.Media.DATE_MODIFIED,
      MediaStore.Images.Media.WIDTH,
      MediaStore.Images.Media.HEIGHT,
      MediaStore.Images.Media.MIME_TYPE
    )
    val sort = "${MediaStore.Images.Media.DATE_TAKEN} DESC"
    val photos = mutableListOf<PhotoMetadata>()

    context.contentResolver.query(collection, projection, selection, args, sort)?.use { cursor ->
      val idCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
      val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME)
      val takenCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_TAKEN)
      val addedCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_ADDED)
      val modifiedCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_MODIFIED)
      val widthCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.WIDTH)
      val heightCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.HEIGHT)
      val mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE)
      while (cursor.moveToNext()) {
        val uri = ContentUris.withAppendedId(collection, cursor.getLong(idCol))
        val originalUri = if (Build.VERSION.SDK_INT >= 29) MediaStore.setRequireOriginal(uri) else uri
        val gps = readGps(originalUri)
        val exifDates = readExifDates(originalUri)
        val dateTakenRaw = cursor.getLongOrNull(takenCol)?.takeIf { it > 0 }
        val dateAddedRaw = cursor.getLongOrNull(addedCol)?.takeIf { it > 0 }
        val dateModifiedRaw = cursor.getLongOrNull(modifiedCol)?.takeIf { it > 0 }
        photos.add(
          PhotoMetadata(
            uri = uri,
            displayName = cursor.getString(nameCol) ?: "",
            dateTaken = dateTakenRaw?.let { Instant.ofEpochMilli(it) },
            dateAdded = dateAddedRaw?.let { Instant.ofEpochSecond(it) },
            exifDateOriginal = exifDates.original?.instant,
            width = cursor.getIntOrNull(widthCol),
            height = cursor.getIntOrNull(heightCol),
            mimeType = cursor.getString(mimeCol),
            latitude = gps?.first,
            longitude = gps?.second,
            dateModified = dateModifiedRaw?.let { Instant.ofEpochSecond(it) },
            exifDateDigitized = exifDates.digitized?.instant,
            exifDateOriginalRaw = exifDates.original?.raw,
            exifDateDigitizedRaw = exifDates.digitized?.raw,
            dateTakenRaw = dateTakenRaw,
            dateAddedRaw = dateAddedRaw,
            dateModifiedRaw = dateModifiedRaw
          )
        )
      }
    }
    return photos
  }

  private fun readGps(uri: Uri): Pair<Double, Double>? {
    return try {
      context.contentResolver.openInputStream(uri)?.use { input ->
        val exif = ExifInterface(input)
        val latLng = exif.latLong ?: return null
        Pair(latLng[0], latLng[1])
      }
    } catch (_: SecurityException) {
      null
    } catch (_: Exception) {
      null
    }
  }

  private fun readExifDates(uri: Uri): ExifDates {
    return try {
      context.contentResolver.openInputStream(uri)?.use { input ->
        val exif = ExifInterface(input)
        ExifDates(
          original = readExifTimestamp(exif, ExifInterface.TAG_DATETIME_ORIGINAL),
          digitized = readExifTimestamp(exif, ExifInterface.TAG_DATETIME_DIGITIZED)
        )
      } ?: ExifDates()
    } catch (_: Exception) {
      ExifDates()
    }
  }

  private fun readExifTimestamp(exif: ExifInterface, tag: String): ExifTimestamp? {
    val value = exif.getAttribute(tag)?.takeIf(String::isNotBlank) ?: return null
    val instant = runCatching {
      val parsed = LocalDateTime.parse(value, DateTimeFormatter.ofPattern("yyyy:MM:dd HH:mm:ss"))
      parsed.atZone(ZoneId.systemDefault()).toInstant()
    }.getOrNull() ?: return null
    return ExifTimestamp(value, instant)
  }

  private data class ExifTimestamp(val raw: String, val instant: Instant)
  private data class ExifDates(val original: ExifTimestamp? = null, val digitized: ExifTimestamp? = null)

  private fun android.database.Cursor.getLongOrNull(index: Int): Long? = if (isNull(index)) null else getLong(index)
  private fun android.database.Cursor.getIntOrNull(index: Int): Int? = if (isNull(index)) null else getInt(index)
}