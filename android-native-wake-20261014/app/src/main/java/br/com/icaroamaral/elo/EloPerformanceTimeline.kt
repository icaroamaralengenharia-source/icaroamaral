package br.com.icaroamaral.elo

import org.json.JSONObject

/**
 * Sanitized, monotonic performance marks for the native shell.
 * No prompt, response, token, identity, or file data is accepted here.
 */
class EloPerformanceTimeline(
    private val clockMs: () -> Long = { System.nanoTime() / 1_000_000L }
) {
    private val marks = linkedMapOf<String, Long>()

    @Synchronized
    fun mark(name: String): Boolean {
        if (name !in ALLOWED_MARKS || marks.containsKey(name)) return false
        marks[name] = clockMs()
        return true
    }

    @Synchronized
    fun hasMark(name: String): Boolean = marks.containsKey(name)

    @Synchronized
    fun snapshot(): Snapshot {
        return Snapshot(
            marks = marks.toMap(),
            metrics = METRIC_PAIRS.mapNotNull { (metric, pair) ->
                val start = marks[pair.first] ?: return@mapNotNull null
                val end = marks[pair.second] ?: return@mapNotNull null
                metric to (end - start).coerceAtLeast(0L)
            }.toMap()
        )
    }

    fun toJson(): String {
        val snapshot = snapshot()
        val marksJson = JSONObject()
        snapshot.marks.forEach { (name, value) -> marksJson.put(name, value) }
        val metricsJson = JSONObject()
        snapshot.metrics.forEach { (name, value) -> metricsJson.put(name, value) }
        return JSONObject()
            .put("marks", marksJson)
            .put("metrics", metricsJson)
            .toString()
    }

    data class Snapshot(
        val marks: Map<String, Long>,
        val metrics: Map<String, Long>
    )

    companion object {
        const val APP_PROCESS_START = "APP_PROCESS_START"
        const val ACTIVITY_CREATE = "ACTIVITY_CREATE"
        const val WEBVIEW_CREATED = "WEBVIEW_CREATED"
        const val PAGE_NAVIGATION_START = "PAGE_NAVIGATION_START"
        const val DOM_READY = "DOM_READY"
        const val ELO_JS_READY = "ELO_JS_READY"
        const val AUTH_BOOTSTRAP_START = "AUTH_BOOTSTRAP_START"
        const val AUTH_READY = "AUTH_READY"
        const val BACKEND_HEALTH_READY = "BACKEND_HEALTH_READY"
        const val CHAT_READY = "CHAT_READY"
        const val APP_INTERACTIVE = "APP_INTERACTIVE"
        const val USER_SEND_CLICK = "USER_SEND_CLICK"
        const val MESSAGE_RENDERED_LOCAL = "MESSAGE_RENDERED_LOCAL"
        const val PROCESSING_INDICATOR_VISIBLE = "PROCESSING_INDICATOR_VISIBLE"
        const val REQUEST_START = "REQUEST_START"
        const val FIRST_RESPONSE_DATA = "FIRST_RESPONSE_DATA"
        const val FIRST_VISIBLE_RESPONSE = "FIRST_VISIBLE_RESPONSE"
        const val RESPONSE_COMPLETE = "RESPONSE_COMPLETE"
        const val RESUME_START = "RESUME_START"
        const val OFFLINE_COMMAND_START = "OFFLINE_COMMAND_START"
        const val OFFLINE_COMMAND_COMPLETE = "OFFLINE_COMMAND_COMPLETE"
        const val FILE_SELECTION_START = "FILE_SELECTION_START"
        const val FILE_SELECTION_TO_READY = "FILE_SELECTION_TO_READY"
        const val IMAGE_SELECTION_START = "IMAGE_SELECTION_START"
        const val IMAGE_SELECTION_TO_READY = "IMAGE_SELECTION_TO_READY"

        val ALLOWED_MARKS = setOf(
            APP_PROCESS_START,
            ACTIVITY_CREATE,
            WEBVIEW_CREATED,
            PAGE_NAVIGATION_START,
            DOM_READY,
            ELO_JS_READY,
            AUTH_BOOTSTRAP_START,
            AUTH_READY,
            BACKEND_HEALTH_READY,
            CHAT_READY,
            APP_INTERACTIVE,
            USER_SEND_CLICK,
            MESSAGE_RENDERED_LOCAL,
            PROCESSING_INDICATOR_VISIBLE,
            REQUEST_START,
            FIRST_RESPONSE_DATA,
            FIRST_VISIBLE_RESPONSE,
            RESPONSE_COMPLETE,
            RESUME_START,
            OFFLINE_COMMAND_START,
            OFFLINE_COMMAND_COMPLETE,
            FILE_SELECTION_START,
            FILE_SELECTION_TO_READY,
            IMAGE_SELECTION_START,
            IMAGE_SELECTION_TO_READY
        )

        private val METRIC_PAIRS = linkedMapOf(
            "TIME_TO_INTERACTIVE" to (APP_PROCESS_START to APP_INTERACTIVE),
            "TIME_TO_AUTH_READY" to (APP_PROCESS_START to AUTH_READY),
            "TIME_TO_CHAT_READY" to (APP_PROCESS_START to CHAT_READY),
            "TIME_TO_FIRST_FEEDBACK" to (USER_SEND_CLICK to MESSAGE_RENDERED_LOCAL),
            "TIME_TO_PROCESSING_INDICATOR" to (USER_SEND_CLICK to PROCESSING_INDICATOR_VISIBLE),
            "TIME_TO_FIRST_VISIBLE_RESPONSE" to (REQUEST_START to FIRST_VISIBLE_RESPONSE),
            "TOTAL_RESPONSE_TIME" to (REQUEST_START to RESPONSE_COMPLETE),
            "RESUME_TO_INTERACTIVE" to (RESUME_START to APP_INTERACTIVE),
            "OFFLINE_COMMAND_LATENCY" to (OFFLINE_COMMAND_START to OFFLINE_COMMAND_COMPLETE),
            "FILE_SELECTION_TO_READY" to (FILE_SELECTION_START to FILE_SELECTION_TO_READY),
            "IMAGE_SELECTION_TO_READY" to (IMAGE_SELECTION_START to IMAGE_SELECTION_TO_READY)
        )
    }
}
