(function () {
  const apiBaseUrl = String(window.OBRAREPORT_API_BASE_URL || "https://obrareport-backend.onrender.com").replace(/\/+$/g, "");

  window.RELATORIO_QUALIDADE_CONFIG = {
    appsScriptUrl: "https://script.google.com/macros/s/AKfycbzmgZcecjYWYMVI2e39iLWHNm9LjmG4SPJiKthXG5N7NEk1oqDnwBN6uBPsBTHLXCrj-w/exec",
    maxFotosUnidade: 20,
    maxInconformidades: 20,
    maxImageWidth: 1280,
    maxImagePixels: 1638400,
    jpegQuality: 0.72,
    aiAssistantUrl: apiBaseUrl + "/api/ai/improve-text",
    aiImageAnalysisUrl: apiBaseUrl + "/api/ai/analyze-image"
  };
})();
