const MAX_PDF_BYTES = 10 * 1024 * 1024;
const PDF_SIGNATURE = Buffer.from("%PDF-");
const PROVIDER_ERRORS = new Map([
  ["artifact_access_denied", 403],
  ["document_artifact_not_found", 404],
  ["artifact_invalid_request", 400],
  ["artifact_not_pdf", 415],
  ["artifact_too_large", 413],
  ["artifact_broker_not_configured", 503]
]);

function brokerError(code, status = 502) {
  return Object.assign(new Error(code), { status });
}

function clean(value) {
  return String(value || "").trim();
}

async function readBounded(response, limit) {
  const declared = Number(response.headers?.get?.("content-length") || 0);
  if (declared > limit) throw brokerError("artifact_too_large", 413);
  if (!response.body?.getReader) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > limit) throw brokerError("artifact_too_large", 413);
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw brokerError("artifact_too_large", 413);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

function validatePdf(bytes) {
  if (!bytes.length || bytes.length > MAX_PDF_BYTES) throw brokerError("artifact_too_large", 413);
  if (!bytes.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) throw brokerError("artifact_not_pdf", 415);
  return { bytes, contentType: "application/pdf" };
}

export function createObraReportArtifactBroker({ brokerUrl = "", brokerSecret = "", provider = "http_pdf", fetchImpl = globalThis.fetch } = {}) {
  const endpoint = clean(brokerUrl);
  const secret = clean(brokerSecret);
  const appsScript = provider === "google_drive_apps_script";
  return {
    mode: "server_side_broker",
    provider,
    async open({ externalFileId, document } = {}) {
      const fileId = clean(externalFileId || document?.external_file_id);
      const documentId = clean(document?.id);
      if (!fileId) throw brokerError("document_artifact_not_found", 404);
      if (!endpoint || !secret || typeof fetchImpl !== "function") throw brokerError("artifact_broker_not_configured", 503);
      let response;
      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          signal: AbortSignal.timeout(30000),
          headers: appsScript
            ? { "Content-Type": "text/plain;charset=utf-8", Accept: "application/json" }
            : { "Content-Type": "application/json", Accept: "application/pdf", "X-ObraReport-Artifact-Secret": secret },
          body: JSON.stringify(appsScript
            ? { app: "ObraReport", action: "artifact.read", externalFileId: fileId, documentId, secret }
            : { externalFileId: fileId, documentId })
        });
      } catch (_) {
        // Fetch errors can retain credential-bearing requests. Never attach them.
        throw brokerError("artifact_broker_unavailable");
      }
      if (!response?.ok || typeof response.arrayBuffer !== "function") throw brokerError("artifact_broker_fetch_failed");
      const contentType = clean(response.headers?.get?.("content-type"));
      if (!appsScript) {
        if (!/^application\/pdf(?:;|$)/i.test(contentType)) throw brokerError("artifact_broker_invalid_content_type");
        let bytes;
        try {
          bytes = await readBounded(response, MAX_PDF_BYTES);
        } catch (error) {
          if (error?.message === "artifact_too_large") throw brokerError("artifact_too_large", 413);
          throw brokerError("artifact_broker_fetch_failed");
        }
        return validatePdf(bytes);
      }
      if (!/^application\/json(?:;|$)/i.test(contentType)) throw brokerError("artifact_broker_invalid_content_type");
      let payload;
      try {
        payload = JSON.parse((await readBounded(response, Math.ceil(MAX_PDF_BYTES / 3) * 4 + 8192)).toString("utf8"));
      } catch (error) {
        if (error?.message === "artifact_too_large") throw error;
        throw brokerError("artifact_broker_invalid_response");
      }
      if (payload?.ok !== true) {
        const code = clean(payload?.errorCode);
        throw brokerError(PROVIDER_ERRORS.has(code) ? code : "artifact_broker_fetch_failed", PROVIDER_ERRORS.get(code) || 502);
      }
      if (payload.mimeType !== "application/pdf") throw brokerError("artifact_not_pdf", 415);
      if (payload.fileId !== fileId || payload.documentId !== documentId) throw brokerError("artifact_broker_identity_mismatch");
      if (!Number.isSafeInteger(payload.size) || payload.size < 1 || payload.size > MAX_PDF_BYTES) throw brokerError("artifact_too_large", 413);
      const base64 = payload.base64;
      if (typeof base64 !== "string" || base64.length !== Math.ceil(payload.size / 3) * 4 ||
          !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
        throw brokerError("artifact_broker_invalid_response");
      }
      const bytes = Buffer.from(base64, "base64");
      if (bytes.length !== payload.size || bytes.toString("base64") !== base64) throw brokerError("artifact_broker_invalid_response");
      return validatePdf(bytes);
    }
  };
}
