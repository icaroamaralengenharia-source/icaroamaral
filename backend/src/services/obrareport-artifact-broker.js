function brokerError(code, status = 502, cause = null) {
  return Object.assign(new Error(code), { status, cause });
}

function clean(value) {
  return String(value || "").trim();
}

export function createObraReportArtifactBroker({ brokerUrl = "", brokerSecret = "", fetchImpl = globalThis.fetch } = {}) {
  const endpoint = clean(brokerUrl);
  const secret = clean(brokerSecret);

  return {
    mode: "server_side_broker",
    async open({ externalFileId, document } = {}) {
      const fileId = clean(externalFileId || (document && document.external_file_id));
      if (!fileId) throw brokerError("document_artifact_not_found", 404);
      if (!endpoint || !secret || typeof fetchImpl !== "function") {
        throw brokerError("artifact_broker_not_configured", 503);
      }

      let response;
      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/pdf",
            "X-ObraReport-Artifact-Secret": secret
          },
          body: JSON.stringify({ externalFileId: fileId, documentId: clean(document && document.id) })
        });
      } catch (error) {
        throw brokerError("artifact_broker_unavailable", 502, error);
      }

      if (!response || !response.ok || typeof response.arrayBuffer !== "function") {
        throw brokerError("artifact_broker_fetch_failed", 502);
      }
      const contentType = clean(response.headers && typeof response.headers.get === "function" ? response.headers.get("content-type") : "");
      if (!/^application\/pdf(?:;|$)/i.test(contentType)) {
        throw brokerError("artifact_broker_invalid_content_type", 502);
      }
      const bytes = await response.arrayBuffer();
      return { bytes, contentType: "application/pdf" };
    }
  };
}
