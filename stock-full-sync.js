(function (window) {
  "use strict";

  const core = window.StockFullCore || {};
  const clean = core.clean || function (value) { return String(value || "").trim(); };

  function isSupabaseConfigured() {
    const config = window.OBRAREPORT_CONFIG || {};
    return Boolean(clean(config.stockFullSupabaseUrl || window.STOCK_FULL_SUPABASE_URL) && clean(config.stockFullSupabaseAnonKey || window.STOCK_FULL_SUPABASE_ANON_KEY));
  }

  function getFallbackStatus() {
    return {
      mode: isSupabaseConfigured() ? "supabase_configured" : "localStorage",
      fallback: !isSupabaseConfigured()
    };
  }

  function mapRemoteMovement(movement, type) {
    const source = movement || {};
    return {
      id: clean(source.id),
      companyId: clean(source.company_id || source.institution_id),
      itemId: clean(source.product_id || source.item_id),
      productId: clean(source.product_id || source.item_id),
      type: clean(source.type || type),
      quantity: Number(source.quantity || 0),
      unitCost: Number(source.unit_cost || 0),
      total: Number(source.total || 0),
      supplier: clean(source.supplier),
      destination: clean(source.destination),
      responsible: clean(source.responsible),
      notes: clean(source.notes),
      date: clean(source.created_at),
      createdAt: clean(source.created_at),
      remoteSource: "supabase"
    };
  }

  window.StockFullSync = {
    isSupabaseConfigured,
    getFallbackStatus,
    mapRemoteMovement
  };
})(window);
