package br.com.icaroamaral.elophotobridge

import java.io.Serializable

enum class PhotoBridgeFlowStatus {
  IDLE,
  WAITING_FOR_DATE,
  SEARCHING_PHOTOS,
  READING_METADATA,
  RESOLVING_LOCATION,
  GROUPING_VISIT,
  MULTIPLE_VISITS,
  WAITING_FOR_VISIT_REFINEMENT,
  USER_DEFINED_VISIT_SELECTED,
  MODE_SELECTION,
  AI_CONFIRMATION,
  FAST_TIMELINE,
  CLASSIFYING_PHOTOS,
  CLASSIFICATION_REVIEW,
  PREPARING_REPORT,
  OPENING_REPORT,
  PAUSED,
  READY_TO_RESUME,
  READY_TO_REVIEW,
  DONE,
  ERROR,
  CANCELLED
}

data class CandidateVisitSummary(
  val id: String,
  val index: Int,
  val city: String,
  val date: String,
  val startTime: String,
  val endTime: String,
  val photoCount: Int
) : Serializable

data class PhotoBridgeUiState(
  val commandText: String = "",
  val reportType: String = "",
  val city: String = "",
  val visitDate: String = "",
  val requestedDate: String = "",
  val dateResolved: Boolean = false,
  val workType: String = "",
  val selectedVisitKey: String = "",
  val selectedVisitId: String = "",
  val refinementStartTime: String = "",
  val refinementEndTime: String = "",
  val refinementCityHint: String = "",
  val candidateVisits: List<CandidateVisitSummary> = emptyList(),
  val candidatePayloadsJson: String = "",
  val photoCount: Int = 0,
  val categoryCounts: Map<String, Int> = emptyMap(),
  val flowStatus: PhotoBridgeFlowStatus = PhotoBridgeFlowStatus.IDLE,
  val statusMessage: String = "ELO Photo Bridge",
  val statusEvents: List<String> = emptyList(),
  val payloadJson: String = "",
  val classificationMode: String = ClassificationMode.NONE.name,
  val timelinePhotoIds: List<String> = emptyList(),
  val cameraStartIndex: Int = 0,
  val tomadasStartIndex: Int = -1,
  val rackStartIndex: Int = -1,
  val mastroStartIndex: Int = -1,
  val caixaStartIndex: Int = -1,
  val timelineManualCategoriesJson: String = ""
) : Serializable {
  fun safeForRestore(): PhotoBridgeUiState {
    return if (flowStatus in processingStatuses) {
      copy(
        flowStatus = PhotoBridgeFlowStatus.READY_TO_RESUME,
        statusMessage = "Fluxo pausado. Continue ou atualize a busca.",
        statusEvents = appendEvent("Fluxo pausado para retomada segura.")
      )
    } else {
      this
    }
  }

  fun withCommand(value: String): PhotoBridgeUiState {
    return copy(commandText = value, workType = detectedWorkType(value, workType))
  }

  fun withEvent(message: String): PhotoBridgeUiState {
    return copy(statusEvents = appendEvent(message))
  }

  private fun appendEvent(message: String): List<String> {
    if (message.isBlank()) return statusEvents
    return (statusEvents + message).takeLast(MAX_EVENTS)
  }

  companion object {
    private const val MAX_EVENTS = 8

    val processingStatuses = setOf(
      PhotoBridgeFlowStatus.SEARCHING_PHOTOS,
      PhotoBridgeFlowStatus.READING_METADATA,
      PhotoBridgeFlowStatus.RESOLVING_LOCATION,
      PhotoBridgeFlowStatus.GROUPING_VISIT,
      PhotoBridgeFlowStatus.CLASSIFYING_PHOTOS,
      PhotoBridgeFlowStatus.PREPARING_REPORT,
      PhotoBridgeFlowStatus.OPENING_REPORT
    )

    fun detectedWorkType(command: String, fallback: String = ""): String {
      val normalized = command.lowercase()
      return when {
        Regex("\\bpm1b\\b|\\bpm\\b").containsMatchIn(normalized) -> "PM1B"
        Regex("\\bdt1b\\b|\\bdt\\b").containsMatchIn(normalized) -> "DT1B"
        else -> fallback
      }
    }
  }
}



