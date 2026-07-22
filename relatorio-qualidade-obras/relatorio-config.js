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
    aiImageAnalysisUrl: apiBaseUrl + "/api/ai/analyze-image",
    eloSupabaseUrl: String(window.ELO_SUPABASE_URL || "https://lidueokjpzxdybtongbk.supabase.co").trim(),
    eloSupabaseAnonKey: String(window.ELO_SUPABASE_ANON_KEY || "").trim(),
    stockFullSupabaseUrl: String(window.STOCK_FULL_SUPABASE_URL || "").trim(),
    stockFullSupabaseAnonKey: String(window.STOCK_FULL_SUPABASE_ANON_KEY || "").trim(),
    stockFullPasswordRedirectUrl: String(window.STOCK_FULL_PASSWORD_REDIRECT_URL || window.location.origin + window.location.pathname + "?produto=stock-full&perfil=loja#app/almoxarifado").trim()
  };
})();
