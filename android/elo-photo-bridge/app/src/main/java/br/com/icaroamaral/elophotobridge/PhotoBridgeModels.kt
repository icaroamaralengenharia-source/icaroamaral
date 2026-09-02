package br.com.icaroamaral.elophotobridge

import android.net.Uri
import java.time.Instant
import java.time.LocalDate

enum class ReportType { SGTO, STELECOM, UNKNOWN }

enum class PhotoCategory {
  CAMERAS,
  TOMADAS,
  RACK,
  CAIXA_FUNDO_MADEIRA,
  MASTRO_ANTENA,
  TOMADA_DADOS,
  TOMADA_CABO_PRETO,
  UNKNOWN
}

enum class PhotoBridgeMode {
  AUTOMATIC_AI,
  SGTO_FAST_TIMELINE
}

enum class ClassificationMode {
  NONE,
  FAST_TIMELINE,
  AI_CLASSIFICATION
}

data class PhotoMetadata(
  val uri: Uri,
  val displayName: String,
  val dateTaken: Instant?,
  val dateAdded: Instant?,
  val exifDateOriginal: Instant?,
  val width: Int?,
  val height: Int?,
  val mimeType: String?,
  val latitude: Double?,
  val longitude: Double?,
  val city: String? = null
) {
  fun bestInstant(): Instant? = exifDateOriginal ?: dateTaken ?: dateAdded
}

data class ParsedCommand(
  val reportType: ReportType,
  val cityHint: String?,
  val dateHint: LocalDate?,
  val latestVisit: Boolean
)

data class VisitGroup(
  val city: String?,
  val date: LocalDate?,
  val photos: List<PhotoMetadata>,
  val confidenceCity: Double,
  val confidenceDate: Double
)

data class UserDefinedVisitWindow(
  val date: LocalDate,
  val startTime: java.time.LocalTime,
  val endTime: java.time.LocalTime,
  val cityHint: String?,
  val photos: List<PhotoMetadata>
)
data class PhotoClassificationResult(
  val category: PhotoCategory,
  val confidence: Double,
  val reason: String,
  val source: String
)

data class ClassifiedPhoto(
  val metadata: PhotoMetadata,
  val category: PhotoCategory,
  val confidence: Double = 0.0,
  val reason: String = "",
  val source: String = "unknown"
)

data class EloPhotoBridgePayload(
  val reportType: ReportType,
  val city: String,
  val visitDate: String,
  val confidenceCity: Double,
  val confidenceDate: Double,
  val photos: Map<PhotoCategory, List<ClassifiedPhoto>>
)

data class BridgeConfig(
  val recentDays: Long = 7,
  val visitWindowMinutes: Long = 180,
  val trustedReportUrl: String = "https://www.icaroamaral.com.br/relatorio-stelecom/",
  val visualAnalysisUrl: String = "https://obrareport-backend.onrender.com/api/ai/analyze-image",
  val visualClassificationTimeoutMs: Long = 15000L
)



