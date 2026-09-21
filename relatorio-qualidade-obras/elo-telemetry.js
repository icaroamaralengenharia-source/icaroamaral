(function (window, document) {
  "use strict";

  var ENDPOINT_PATH = "/api/elo/telemetry";
  var BUFFER_KEY = "elo_telemetry_buffer_v1";
  var MAX_BUFFER = 200;
  var BATCH_SIZE = 25;
  var FLUSH_INTERVAL = 15000;
  var MAX_RETRY_DELAY = 60000;
  var SAFE_EVENTS = {
    APP_OPEN: 1, APP_READY: 1, AUTH_VALIDATED: 1, AUTH_FAILED: 1, AUTH_EXPIRED: 1, ONLINE: 1, OFFLINE: 1,
    BACKEND_UNAVAILABLE: 1, BACKEND_RECOVERED: 1, CHAT_SENT: 1, CHAT_RESPONSE: 1, CHAT_FAILED: 1,
    ATTACHMENT_SELECTED: 1, ATTACHMENT_PROCESSED: 1, ATTACHMENT_FAILED: 1, IMAGE_ANALYSIS: 1, IMAGE_FAILED: 1,
    PROACTIVE_REASONING: 1, SELF_CHECK: 1, ACTION_EXECUTED: 1, ACTION_FAILED: 1, OFFLINE_COMMAND: 1,
    OFFLINE_FALLBACK: 1, MUSIC_PLAY: 1, MUSIC_FAILED: 1, REPORT_GENERATED: 1, REPORT_FAILED: 1,
    MEMORY_USED: 1, MEMORY_FAILED: 1, RETRY: 1, FEEDBACK_SUBMITTED: 1, CRASH_DETECTED: 1, ANR_DETECTED: 1
  };
  var SAFE_STATUS = { SUCCESS: 1, ERROR: 1, OFFLINE: 1, FALLBACK: 1, PENDING: 1 };
  var SAFE_MODEL = { LOCAL: 1, CHEAP_REMOTE: 1, STANDARD: 1, HIGH_REASONING: 1 };
  var memoryQueue = [];
  var flushing = false;
  var retryAttempt = 0;
  var nextFlushAt = 0;
  var lastFlushError = "";
  var sessionSeed = null;
  var sessionHashPromise = null;

  function text(value, max) {
    if (value === undefined || value === null) return "";
    return String(value).trim().slice(0, max || 80);
  }

  function readQueue() {
    if (memoryQueue.length) return memoryQueue.slice();
    try {
      var parsed = JSON.parse(window.localStorage.getItem(BUFFER_KEY) || "[]");
      memoryQueue = Array.isArray(parsed) ? parsed.slice(-MAX_BUFFER) : [];
    } catch (_) { memoryQueue = []; }
    return memoryQueue.slice();
  }

  function writeQueue(queue) {
    memoryQueue = queue.slice(-MAX_BUFFER);
    try { window.localStorage.setItem(BUFFER_KEY, JSON.stringify(memoryQueue)); } catch (_) {}
  }

  function makeHash(value) {
    if (!window.crypto || !window.crypto.subtle || !window.TextEncoder) return Promise.resolve("");
    return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)).then(function (buffer) {
      return Array.prototype.map.call(new Uint8Array(buffer), function (part) { return ("00" + part.toString(16)).slice(-2); }).join("");
    }).catch(function () { return ""; });
  }

  function getSessionHash() {
    if (!sessionHashPromise) {
      try {
        sessionSeed = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : String(Date.now()) + Math.random();
      } catch (_) { sessionSeed = String(Date.now()) + Math.random(); }
      sessionHashPromise = makeHash(sessionSeed);
    }
    return sessionHashPromise;
  }

  function bucketLatency(value) {
    var number = Number(value);
    if (!isFinite(number) || number < 0) return "";
    if (number < 250) return "<250ms";
    if (number < 500) return "250-500ms";
    if (number < 1000) return "500ms-1s";
    if (number < 2000) return "1-2s";
    if (number < 5000) return "2-5s";
    if (number < 10000) return "5-10s";
    return ">10s";
  }

  function bucketBytes(value) {
    var number = Number(value);
    if (!isFinite(number) || number <= 0) return "0";
    if (number < 10240) return "<10KB";
    if (number < 102400) return "10-100KB";
    if (number < 1048576) return "100KB-1MB";
    if (number < 5242880) return "1-5MB";
    return ">5MB";
  }

  function normalizeEvent(eventType, details, sessionHash) {
    var input = details && typeof details === "object" ? details : {};
    if (!SAFE_EVENTS[eventType]) return null;
    var event = {
      event_id: text(window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : String(Date.now()) + Math.random(), 80),
      timestamp: new Date().toISOString(),
      session_hash: sessionHash || "",
      surface: window.ELO_TELEMETRY_SURFACE === "ANDROID_WEBVIEW" ? "ANDROID_WEBVIEW" : "WEB",
      event_type: eventType,
      route: text(input.route, 40),
      answer_mode: text(input.answer_mode, 30),
      proactivity_level: text(input.proactivity_level, 30),
      self_check_level: text(input.self_check_level, 30),
      status: SAFE_STATUS[input.status] ? input.status : "SUCCESS",
      http_status: Number.isFinite(Number(input.http_status)) ? Math.max(0, Math.min(599, Math.round(Number(input.http_status)))) : undefined,
      latency_ms: Number.isFinite(Number(input.latency_ms)) ? Math.max(0, Math.round(Number(input.latency_ms))) : undefined,
      backend_latency_ms: Number.isFinite(Number(input.backend_latency_ms)) ? Math.max(0, Math.round(Number(input.backend_latency_ms))) : undefined,
      model_latency_ms: Number.isFinite(Number(input.model_latency_ms)) ? Math.max(0, Math.round(Number(input.model_latency_ms))) : undefined,
      error_code: text(input.error_code, 50),
      fallback_used: input.fallback_used === true ? true : input.fallback_used === false ? false : undefined,
      offline_used: input.offline_used === true ? true : input.offline_used === false ? false : undefined,
      retry_count: Number.isFinite(Number(input.retry_count)) ? Math.max(0, Math.min(20, Math.round(Number(input.retry_count)))) : undefined,
      attachment_type: text(input.attachment_type, 40),
      attachment_size_bucket: bucketBytes(input.attachment_size),
      response_size_bucket: bucketBytes(input.response_size),
      context_turn_count_bucket: Number(input.context_turn_count) > 10 ? ">10" : Number(input.context_turn_count) > 3 ? "4-10" : Number(input.context_turn_count) > 0 ? "1-3" : "0",
      memory_used: input.memory_used === true ? true : input.memory_used === false ? false : undefined,
      project_context_used: input.project_context_used === true ? true : input.project_context_used === false ? false : undefined,
      risk_detected: input.risk_detected === true ? true : input.risk_detected === false ? false : undefined,
      missing_essential_count: Number.isFinite(Number(input.missing_essential_count)) ? Math.max(0, Math.min(20, Math.round(Number(input.missing_essential_count)))) : undefined,
      action_type: text(input.action_type, 40),
      model_class: SAFE_MODEL[input.model_class] ? input.model_class : undefined,
      token_usage_bucket: text(input.token_usage_bucket, 20),
      estimated_cost_bucket: text(input.estimated_cost_bucket, 20)
    };
    if (/^[a-f0-9]{32,128}$/i.test(text(input.response_event_hash, 128))) {
      event.response_event_hash = text(input.response_event_hash, 128).toLowerCase();
    }
    Object.keys(event).forEach(function (key) { if (event[key] === undefined || event[key] === "") delete event[key]; });
    return event;
  }

  function getEndpoint() {
    if (window.EloRuntimeConfig && typeof window.EloRuntimeConfig.apiUrl === "function") {
      return window.EloRuntimeConfig.apiUrl(ENDPOINT_PATH);
    }
    var base = String(window.ELO_API_BASE_URL || window.OBRAREPORT_API_BASE_URL || "https://obrareport-backend.onrender.com").replace(/\/+$/g, "");
    return base + ENDPOINT_PATH;
  }

  function enqueue(event) {
    var queue = readQueue();
    queue.push(event);
    writeQueue(queue);
    if (queue.length >= BATCH_SIZE) flush();
  }

  function track(eventType, details) {
    return getSessionHash().then(function (sessionHash) {
      var event = normalizeEvent(eventType, details, sessionHash);
      if (event) enqueue(event);
      return event;
    }).catch(function () { return null; });
  }

  function getRetryAfterMs(response) {
    var retryAfter = response && response.headers && response.headers.get ? response.headers.get("Retry-After") : "";
    var seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(MAX_RETRY_DELAY, Math.max(1000, Math.round(seconds * 1000)));
    return 0;
  }

  function scheduleRetry(response) {
    var status = Number(response && response.status) || 0;
    var retryAfter = status === 429 ? getRetryAfterMs(response) : 0;
    var delay = retryAfter || (status === 404 || status === 405
      ? MAX_RETRY_DELAY
      : Math.min(MAX_RETRY_DELAY, FLUSH_INTERVAL * Math.pow(2, retryAttempt)));
    retryAttempt = Math.min(retryAttempt + 1, 8);
    nextFlushAt = Date.now() + delay;
    lastFlushError = status ? String(status) : "network";
  }

  function resetRetry() {
    retryAttempt = 0;
    nextFlushAt = 0;
    lastFlushError = "";
  }

  function flush(options) {
    var force = options && options.force === true;
    if (flushing) return Promise.resolve(false);
    var queue = readQueue();
    if (!queue.length || !window.fetch) return Promise.resolve(false);
    if (!force && Date.now() < nextFlushAt) return Promise.resolve(false);
    flushing = true;
    var batch = queue.slice(0, BATCH_SIZE);
    return window.fetch(getEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      keepalive: true
    }).then(function (response) {
      if (!response || !response.ok) {
        scheduleRetry(response);
        throw new Error("telemetry_not_accepted");
      }
      writeQueue(readQueue().slice(batch.length));
      resetRetry();
      return true;
    }).catch(function () { return false; }).finally(function () { flushing = false; });
  }

  window.EloTelemetry = {
    track: track,
    flush: flush,
    bucketLatency: bucketLatency,
    bucketBytes: bucketBytes,
    getPendingCount: function () { return readQueue().length; },
    getRetryState: function () { return { retry_attempt: retryAttempt, next_flush_at: nextFlushAt, last_error: lastFlushError }; },
    clear: function () { writeQueue([]); }
  };

  function trackFeedback(button) {
    var type = text(button && button.getAttribute("data-elo-feedback"), 30);
    if (!type || !window.EloTelemetry) return;
    var container = button.closest ? button.closest("[data-elo-feedback-group]") : null;
    if (container && container.getAttribute("data-elo-feedback-submitted") === "true") return;
    if (container) container.setAttribute("data-elo-feedback-submitted", "true");
    var rating = type === "THUMBS_DOWN" || type === "NOT_HELPFUL" ? "NOT_HELPFUL" : "HELPFUL";
    var responseId = container && container.getAttribute("data-elo-response-id") || "";
    makeHash("elo-response:" + responseId).then(function (responseEventHash) {
      window.EloTelemetry.track("FEEDBACK_SUBMITTED", {
        route: "chat",
        action_type: rating,
        response_event_hash: responseEventHash,
        status: "SUCCESS"
      });
    });
  }

  document.addEventListener("click", function (event) {
    var target = event.target && event.target.closest ? event.target.closest("[data-elo-feedback]") : null;
    if (target) trackFeedback(target);
  });
  window.addEventListener("online", function () { resetRetry(); track("ONLINE", { status: "SUCCESS" }); flush({ force: true }); });
  window.addEventListener("offline", function () { track("OFFLINE", { status: "OFFLINE", offline_used: true }); });
  document.addEventListener("DOMContentLoaded", function () { track("APP_READY", { status: "SUCCESS" }); flush(); });
  track("APP_OPEN", { status: "SUCCESS" });
  window.setInterval(flush, FLUSH_INTERVAL);
  window.addEventListener("pagehide", flush);
})(window, document);
