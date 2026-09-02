package br.com.icaroamaral.elophotobridge

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

class PhotoBridgeStateStore(context: Context) {
  private val prefs = context.getSharedPreferences("elo_photo_bridge_screen_state", Context.MODE_PRIVATE)

  fun load(): PhotoBridgeUiState {
    val raw = prefs.getString(KEY_STATE, null) ?: return PhotoBridgeUiState()
    return runCatching { decode(raw).safeForRestore() }.getOrDefault(PhotoBridgeUiState())
  }

  fun save(state: PhotoBridgeUiState) {
    prefs.edit().putString(KEY_STATE, encode(state)).apply()
  }

  fun clear() {
    prefs.edit().remove(KEY_STATE).apply()
  }

  fun mergePayload(current: PhotoBridgeUiState, payloadJson: String): PhotoBridgeUiState {
    val json = runCatching { JSONObject(payloadJson) }.getOrNull() ?: return current.copy(
      payloadJson = payloadJson,
      flowStatus = PhotoBridgeFlowStatus.READY_TO_REVIEW,
      statusMessage = "Resumo pronto para revisao no gerador."
    ).withEvent("Payload preparado para revisao.")
    val photos = json.optJSONObject("photos") ?: JSONObject()
    val categoryCounts = mutableMapOf<String, Int>()
    var total = 0
    val keys = photos.keys()
    while (keys.hasNext()) {
      val key = keys.next()
      val count = photos.optJSONArray(key)?.length() ?: 0
      categoryCounts[key] = count
      total += count
    }
    val city = json.optString("city").takeUnless { it.isBlank() || it == "UNKNOWN" } ?: current.city
    val visitDate = json.optString("visitDate").takeUnless { it.isBlank() || it == "AMBIGUOUS" } ?: current.visitDate
    val reportType = json.optString("reportType").takeUnless { it.isBlank() || it == "UNKNOWN" } ?: current.reportType
    return current.copy(
      reportType = reportType,
      city = city,
      visitDate = visitDate,
      requestedDate = visitDate,
      dateResolved = visitDate.isNotBlank(),
      selectedVisitKey = listOf(city, visitDate, reportType).filter { it.isNotBlank() }.joinToString("|"),
      selectedVisitId = current.selectedVisitId,
      photoCount = total,
      categoryCounts = categoryCounts,
      flowStatus = PhotoBridgeFlowStatus.READY_TO_REVIEW,
      statusMessage = "Resumo pronto para revisao no gerador.",
      payloadJson = payloadJson
    ).withEvent("$total foto(s) prontas para revisao.")
  }

  private fun encode(state: PhotoBridgeUiState): String {
    val categories = JSONObject()
    state.categoryCounts.forEach { (key, value) -> categories.put(key, value) }
    val events = JSONArray()
    state.statusEvents.forEach(events::put)
    val candidates = JSONArray()
    val timelinePhotoIds = JSONArray()
    state.timelinePhotoIds.forEach(timelinePhotoIds::put)
    state.candidateVisits.forEach { visit ->
      candidates.put(JSONObject()
        .put("id", visit.id)
        .put("index", visit.index)
        .put("city", visit.city)
        .put("date", visit.date)
        .put("startTime", visit.startTime)
        .put("endTime", visit.endTime)
        .put("photoCount", visit.photoCount))
    }
    return JSONObject()
      .put("commandText", state.commandText)
      .put("reportType", state.reportType)
      .put("city", state.city)
      .put("visitDate", state.visitDate)
      .put("requestedDate", state.requestedDate)
      .put("dateResolved", state.dateResolved)
      .put("workType", state.workType)
      .put("selectedVisitKey", state.selectedVisitKey)
      .put("selectedVisitId", state.selectedVisitId)
      .put("refinementStartTime", state.refinementStartTime)
      .put("refinementEndTime", state.refinementEndTime)
      .put("refinementCityHint", state.refinementCityHint)
      .put("candidateVisits", candidates)
      .put("candidatePayloadsJson", state.candidatePayloadsJson)
      .put("photoCount", state.photoCount)
      .put("categoryCounts", categories)
      .put("flowStatus", state.flowStatus.name)
      .put("statusMessage", state.statusMessage)
      .put("statusEvents", events)
      .put("payloadJson", state.payloadJson)
      .put("classificationMode", state.classificationMode)
      .put("timelinePhotoIds", timelinePhotoIds)
      .put("cameraStartIndex", state.cameraStartIndex)
      .put("tomadasStartIndex", state.tomadasStartIndex)
      .put("rackStartIndex", state.rackStartIndex)
      .put("mastroStartIndex", state.mastroStartIndex)
      .put("caixaStartIndex", state.caixaStartIndex)
      .put("timelineManualCategoriesJson", state.timelineManualCategoriesJson)
      .toString()
  }

  private fun decode(raw: String): PhotoBridgeUiState {
    val json = JSONObject(raw)
    val categories = json.optJSONObject("categoryCounts") ?: JSONObject()
    val categoryCounts = mutableMapOf<String, Int>()
    val keys = categories.keys()
    while (keys.hasNext()) {
      val key = keys.next()
      categoryCounts[key] = categories.optInt(key, 0)
    }
    val eventsJson = json.optJSONArray("statusEvents") ?: JSONArray()
    val events = buildList {
      for (index in 0 until eventsJson.length()) add(eventsJson.optString(index))
    }.filter(String::isNotBlank)
    val timelinePhotoIdsJson = json.optJSONArray("timelinePhotoIds") ?: JSONArray()
    val timelinePhotoIds = buildList {
      for (index in 0 until timelinePhotoIdsJson.length()) add(timelinePhotoIdsJson.optString(index))
    }.filter(String::isNotBlank)
    val candidatesJson = json.optJSONArray("candidateVisits") ?: JSONArray()
    val candidates = buildList {
      for (index in 0 until candidatesJson.length()) {
        val item = candidatesJson.optJSONObject(index) ?: continue
        add(CandidateVisitSummary(
          id = item.optString("id"),
          index = item.optInt("index"),
          city = item.optString("city"),
          date = item.optString("date"),
          startTime = item.optString("startTime"),
          endTime = item.optString("endTime"),
          photoCount = item.optInt("photoCount", 0)
        ))
      }
    }
    return PhotoBridgeUiState(
      commandText = json.optString("commandText"),
      reportType = json.optString("reportType"),
      city = json.optString("city"),
      visitDate = json.optString("visitDate"),
      requestedDate = json.optString("requestedDate"),
      dateResolved = json.optBoolean("dateResolved", false),
      workType = json.optString("workType"),
      selectedVisitKey = json.optString("selectedVisitKey"),
      selectedVisitId = json.optString("selectedVisitId"),
      refinementStartTime = json.optString("refinementStartTime"),
      refinementEndTime = json.optString("refinementEndTime"),
      refinementCityHint = json.optString("refinementCityHint"),
      candidateVisits = candidates,
      candidatePayloadsJson = json.optString("candidatePayloadsJson"),
      photoCount = json.optInt("photoCount", 0),
      categoryCounts = categoryCounts,
      flowStatus = runCatching { PhotoBridgeFlowStatus.valueOf(json.optString("flowStatus")) }.getOrDefault(PhotoBridgeFlowStatus.IDLE),
      statusMessage = json.optString("statusMessage", "ELO Photo Bridge"),
      statusEvents = events,
      payloadJson = json.optString("payloadJson"),
      classificationMode = json.optString("classificationMode", ClassificationMode.NONE.name),
      timelinePhotoIds = timelinePhotoIds,
      cameraStartIndex = json.optInt("cameraStartIndex", 0),
      tomadasStartIndex = json.optInt("tomadasStartIndex", -1),
      rackStartIndex = json.optInt("rackStartIndex", -1),
      mastroStartIndex = json.optInt("mastroStartIndex", -1),
      caixaStartIndex = json.optInt("caixaStartIndex", -1),
      timelineManualCategoriesJson = json.optString("timelineManualCategoriesJson")
    )
  }

  companion object {
    private const val KEY_STATE = "screen_state"
  }
}



