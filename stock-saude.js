(function () {
  "use strict";

  const STORAGE_KEY = "obrareport_stock_saude_state_v1";
  const STOCK_SAUDE_DEMO_INSTITUTION_ID = "00000000-0000-0000-0000-000000000001";
  const STOCK_SAUDE_DEMO_UNIT_ID = "00000000-0000-0000-0000-000000000001";
  const STOCK_SAUDE_DEMO_PROFILE_ID = "00000000-0000-0000-0000-000000000001";
  const STOCK_SAUDE_API_TIMEOUT_MS = 3000;
  const EXPIRATION_WINDOWS = [7, 30, 60, 90];
  const SECTORS = [
    "Farmacia hospitalar",
    "UPA Centro",
    "Ambulatorio",
    "Enfermaria",
    "Centro cirurgico",
    "Almoxarifado central",
    "Vacinacao",
    "Urgencia"
  ];

  const elements = {
    itemForm: document.getElementById("stockSaudeItemForm"),
    entryForm: document.getElementById("stockSaudeEntryForm"),
    exitForm: document.getElementById("stockSaudeExitForm"),
    dashboard: document.getElementById("stockSaudeDashboard"),
    approvals: document.getElementById("stockSaudeApprovals"),
    alerts: document.getElementById("stockSaudeAlerts"),
    history: document.getElementById("stockSaudeHistory"),
    resetDemo: document.getElementById("stockSaudeResetDemo"),
    storageStatus: document.getElementById("stockSaudeStorageStatus"),
    sectorSelect: document.getElementById("stockSaudeSectorSelect"),
    filterSector: document.getElementById("stockSaudeFilterSector"),
    filterResponsible: document.getElementById("stockSaudeFilterResponsible")
  };

  let activeHistoryFilter = "todos";
  let stockSaudeRuntimeMode = "local";
  let stockSaudeRemoteCache = {
    items: [],
    entries: [],
    exits: [],
    balance: [],
    dashboard: null,
    auditLog: []
  };
  let stockSaudeAuthContext = {
    mode: "local",
    user: null,
    profile: null,
    institutionId: STOCK_SAUDE_DEMO_INSTITUTION_ID,
    unitId: STOCK_SAUDE_DEMO_UNIT_ID,
    profileId: STOCK_SAUDE_DEMO_PROFILE_ID
  };

  const StockSaudeAPI = {
    async request(path, options) {
      const controller = new AbortController();
      const timeout = window.setTimeout(function () {
        controller.abort();
      }, STOCK_SAUDE_API_TIMEOUT_MS);
      const requestOptions = options || {};
      const headers = Object.assign({
        "Content-Type": "application/json"
      }, requestOptions.headers || {});

      try {
        const response = await fetch(path, Object.assign({}, requestOptions, {
          headers: headers,
          signal: controller.signal
        }));
        const data = await response.json().catch(function () {
          return {};
        });
        if (!response.ok || data.ok === false) {
          const error = new Error(data.error || "stock_saude_remote_error");
          error.status = response.status;
          error.payload = data;
          throw error;
        }
        return data;
      } finally {
        window.clearTimeout(timeout);
      }
    },

    async health() {
      return this.request("/api/stock-saude/health", {
        method: "GET"
      });
    },

    async isRemoteAvailable() {
      try {
        const health = await this.health();
        return health && health.database === "supabase_configured";
      } catch (error) {
        return false;
      }
    },

    async me(token) {
      return this.request("/api/stock-saude/me", {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token
        }
      });
    },

    async listItems(token) {
      const data = await this.request("/api/stock-saude/items", {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token
        }
      });
      return data.items || [];
    },

    async createItem(token, item) {
      const data = await this.request("/api/stock-saude/items", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(item)
      });
      return data.item;
    },

    async listEntries(token) {
      const data = await this.request("/api/stock-saude/entries", {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token
        }
      });
      return data.entries || [];
    },

    async createEntry(token, entry) {
      const data = await this.request("/api/stock-saude/entries", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(entry)
      });
      return data.entry;
    },

    async approveEntry(token, entryId) {
      const data = await this.request("/api/stock-saude/entries/" + encodeURIComponent(entryId) + "/approve", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token
        }
      });
      return data.entry;
    },

    async rejectEntry(token, entryId) {
      const data = await this.request("/api/stock-saude/entries/" + encodeURIComponent(entryId) + "/reject", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token
        }
      });
      return data.entry;
    },

    async listExits(token) {
      const data = await this.request("/api/stock-saude/exits", {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token
        }
      });
      return data.exits || [];
    },

    async createExit(token, exitData) {
      const data = await this.request("/api/stock-saude/exits", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(exitData)
      });
      return data.exit;
    },

    async getBalance(token) {
      const data = await this.request("/api/stock-saude/balance", {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token
        }
      });
      return data.balance || [];
    },

    async getDashboard(token) {
      const data = await this.request("/api/stock-saude/dashboard", {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token
        }
      });
      return data.dashboard || null;
    },

    async listAuditLog(token) {
      const data = await this.request("/api/stock-saude/audit-log", {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token
        }
      });
      return data.auditLog || [];
    }
  };

  function clean(value) {
    return String(value || "").trim();
  }

  function numberValue(value) {
    const parsed = Number(String(value || "0").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function currentTime() {
    return new Date().toTimeString().slice(0, 5);
  }

  function createId(prefix) {
    return (prefix || "stock-saude") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function normalizeText(value) {
    return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(numberValue(value));
  }

  function formatDate(value) {
    if (!value) {
      return "-";
    }
    const date = new Date(value + "T00:00:00");
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString("pt-BR");
  }

  function daysUntil(value) {
    if (!value) {
      return null;
    }
    const date = new Date(value + "T00:00:00");
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    const today = new Date(todayKey() + "T00:00:00");
    return Math.ceil((date.getTime() - today.getTime()) / 86400000);
  }

  function getStorage() {
    try {
      return window.localStorage || null;
    } catch (error) {
      return null;
    }
  }

  function getSessionStorage() {
    try {
      return window.sessionStorage || null;
    } catch (error) {
      return null;
    }
  }

  function findSupabaseAccessToken(value, depth) {
    if (!value || depth > 5) {
      return null;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) {
        return trimmed;
      }
      if ((trimmed[0] === "{" && trimmed[trimmed.length - 1] === "}") || (trimmed[0] === "[" && trimmed[trimmed.length - 1] === "]")) {
        try {
          return findSupabaseAccessToken(JSON.parse(trimmed), depth + 1);
        } catch (error) {
          return null;
        }
      }
      return null;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const token = findSupabaseAccessToken(item, depth + 1);
        if (token) {
          return token;
        }
      }
      return null;
    }
    if (typeof value === "object") {
      if (typeof value.access_token === "string") {
        return findSupabaseAccessToken(value.access_token, depth + 1);
      }
      if (value.currentSession) {
        const token = findSupabaseAccessToken(value.currentSession, depth + 1);
        if (token) {
          return token;
        }
      }
      if (value.session) {
        const token = findSupabaseAccessToken(value.session, depth + 1);
        if (token) {
          return token;
        }
      }
      for (const key of Object.keys(value)) {
        const token = findSupabaseAccessToken(value[key], depth + 1);
        if (token) {
          return token;
        }
      }
    }
    return null;
  }

  function getStockSaudeSupabaseToken() {
    try {
      const stores = [getStorage(), getSessionStorage()].filter(Boolean);
      for (const store of stores) {
        for (let index = 0; index < store.length; index += 1) {
          const key = store.key(index) || "";
          const normalizedKey = key.toLowerCase();
          if (normalizedKey.indexOf("supabase") < 0 && normalizedKey.indexOf("sb-") !== 0) {
            continue;
          }
          const token = findSupabaseAccessToken(store.getItem(key), 0);
          if (token) {
            return token;
          }
        }
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  async function fetchStockSaudeMe() {
    const token = getStockSaudeSupabaseToken();
    if (!token) {
      return null;
    }
    try {
      const data = await StockSaudeAPI.me(token);
      if (data && data.user && data.profile) {
        return {
          user: data.user,
          profile: data.profile
        };
      }
    } catch (error) {
      if (window.console && console.info) {
        console.info("Stock Saude: sessao Supabase indisponivel para o Stock Saude.");
      }
    }
    return null;
  }

  async function initStockSaudeAuthContext() {
    try {
      const session = await fetchStockSaudeMe();
      if (session && session.profile) {
        stockSaudeAuthContext = {
          mode: "supabase",
          user: session.user,
          profile: session.profile,
          institutionId: session.profile.institution_id || STOCK_SAUDE_DEMO_INSTITUTION_ID,
          unitId: session.profile.unit_id || STOCK_SAUDE_DEMO_UNIT_ID,
          profileId: session.profile.id || STOCK_SAUDE_DEMO_PROFILE_ID
        };
        if (window.console && console.info) {
          console.info("Stock Saude: sessao Supabase reconhecida.");
        }
        return stockSaudeAuthContext;
      }
    } catch (error) {
      // Mantem a tela inicializando em modo local.
    }
    stockSaudeAuthContext = {
      mode: "local",
      user: null,
      profile: null,
      institutionId: STOCK_SAUDE_DEMO_INSTITUTION_ID,
      unitId: STOCK_SAUDE_DEMO_UNIT_ID,
      profileId: STOCK_SAUDE_DEMO_PROFILE_ID
    };
    if (window.console && console.info) {
      console.info("Stock Saude: modo local ativo.");
    }
    return stockSaudeAuthContext;
  }

  function getStockSaudeInstitutionId() {
    return stockSaudeAuthContext.institutionId || STOCK_SAUDE_DEMO_INSTITUTION_ID;
  }

  function getStockSaudeUnitId() {
    return stockSaudeAuthContext.unitId || STOCK_SAUDE_DEMO_UNIT_ID;
  }

  function getStockSaudeProfileId() {
    return stockSaudeAuthContext.profileId || STOCK_SAUDE_DEMO_PROFILE_ID;
  }

  function getStockSaudeAuthTokenOrThrow() {
    const token = getStockSaudeSupabaseToken();
    if (!token) {
      throw new Error("stock_saude_auth_token_missing");
    }
    return token;
  }

  function canStockSaudeRole(action) {
    if (stockSaudeAuthContext.mode !== "supabase") {
      return true;
    }
    const role = clean(stockSaudeAuthContext.profile && stockSaudeAuthContext.profile.role).toLowerCase();
    if (role === "administrador") {
      return true;
    }
    const permissions = {
      gestor: ["create_item", "create_entry", "create_exit", "approve_entry", "reject_entry", "read"],
      almoxarife: ["create_item", "create_entry", "create_exit", "read"],
      leitura: ["read"]
    };
    return Boolean(permissions[role] && permissions[role].indexOf(action) >= 0);
  }

  function stockSaudePermissionMessage() {
    return "Seu perfil nao tem permissao para esta acao.";
  }

  function buildDemoState() {
    const items = [
      ["Dipirona 500mg", "Medicamento", "caixa", 180, 80, "DIP-500-A", "2026-08-30", "MedSul", "NF-1001", "Farmacia hospitalar", "15-25C", false],
      ["Amoxicilina 500mg", "Medicamento", "caixa", 42, 60, "AMX-332", "2026-06-22", "FarmaMais", "NF-1002", "Farmacia hospitalar", "15-25C", false],
      ["Luvas cirurgicas", "EPI", "caixa", 320, 120, "LUV-802", "2027-02-18", "Saude Norte", "NF-1003", "Almoxarifado central", "Ambiente", false],
      ["Mascaras descartaveis", "EPI", "un", 8432, 1200, "MAS-118", "2027-04-10", "ProtecMed", "NF-1004", "Almoxarifado central", "Ambiente", false],
      ["Seringas 10ml", "Material hospitalar", "un", 900, 300, "SER-10", "2028-01-15", "Hospitalar Prime", "NF-1005", "Enfermaria", "Ambiente", false],
      ["Gaze esteril", "Material hospitalar", "pacote", 210, 220, "GAZ-77", "2026-07-04", "Curativos BR", "NF-1006", "Centro cirurgico", "Ambiente", false],
      ["Alcool 70%", "Limpeza", "frasco", 60, 90, "ALC-70", "2026-06-10", "Higienix", "NF-1007", "Urgencia", "Ambiente", false],
      ["Vacina Hepatite B", "Vacina", "dose", 140, 50, "VAC-HB", "2026-09-25", "Rede Frio", "NF-1008", "Vacinacao", "2-8C", true],
      ["Cefalexina 500mg", "Medicamento", "caixa", 12, 40, "CEF-55", "2026-06-28", "FarmaMais", "NF-1009", "Farmacia hospitalar", "15-25C", false],
      ["Atadura", "Material hospitalar", "rolo", 500, 180, "ATA-12", "2027-11-03", "Curativos BR", "NF-1010", "Almoxarifado central", "Ambiente", false]
    ].map(function (item) {
      return createItem({
        name: item[0],
        category: item[1],
        unit: item[2],
        quantity: item[3],
        minimumStock: item[4],
        lot: item[5],
        expirationDate: item[6],
        supplier: item[7],
        invoice: item[8],
        storageLocation: item[9],
        temperature: item[10],
        controlled: item[11] ? "sim" : "nao"
      }, true);
    });

    const state = {
      items: items,
      entries: [],
      exits: [],
      sectors: SECTORS.slice(),
      updatedAt: new Date().toISOString()
    };

    state.entries.push(createEntry({
      itemId: items[1].id,
      date: todayKey(),
      time: "08:40",
      quantity: 30,
      lot: "AMX-NEW",
      expirationDate: "2027-05-20",
      supplier: "FarmaMais",
      invoice: "NF-2026",
      receivedBy: "Tec. Paulo Lima",
      notes: "Recebimento conferido pelo almoxarifado.",
      status: "pendente"
    }));

    state.exits.push(createExit({
      itemId: items[0].id,
      date: todayKey(),
      time: "14:32",
      quantity: 20,
      withdrawnBy: "Enf. Mariana Souza",
      roleRegistration: "COREN 11452",
      sector: "Centro cirurgico",
      purpose: "Reposicao de sala",
      lot: items[0].lot,
      expirationDate: items[0].expirationDate,
      releasedBy: "Farm. Carlos Menezes",
      notes: "Saida demo auditavel."
    }));

    return state;
  }

  function createItem(data, keepId) {
    const now = new Date().toISOString();
    return {
      id: keepId && data.id ? data.id : createId("ssi"),
      name: clean(data.name),
      category: clean(data.category) || "Outro",
      unit: clean(data.unit) || "un",
      initialQuantity: numberValue(data.initialQuantity !== undefined ? data.initialQuantity : data.quantity),
      minimumStock: numberValue(data.minimumStock),
      lot: clean(data.lot),
      expirationDate: clean(data.expirationDate),
      supplier: clean(data.supplier),
      invoice: clean(data.invoice),
      storageLocation: clean(data.storageLocation),
      temperature: clean(data.temperature),
      controlled: clean(data.controlled) === "sim" || data.controlled === true,
      createdAt: data.createdAt || now,
      updatedAt: now
    };
  }

  function createEntry(data) {
    const now = new Date().toISOString();
    return {
      id: data.id || createId("sse"),
      date: clean(data.date) || todayKey(),
      time: clean(data.time) || currentTime(),
      itemId: clean(data.itemId),
      quantity: numberValue(data.quantity),
      lot: clean(data.lot),
      expirationDate: clean(data.expirationDate),
      supplier: clean(data.supplier),
      invoice: clean(data.invoice),
      receivedBy: clean(data.receivedBy),
      notes: clean(data.notes),
      status: clean(data.status) || "pendente",
      decisionAt: clean(data.decisionAt),
      decisionBy: clean(data.decisionBy),
      createdAt: data.createdAt || now,
      updatedAt: now
    };
  }

  function createExit(data) {
    const now = new Date().toISOString();
    return {
      id: data.id || createId("ssx"),
      date: clean(data.date) || todayKey(),
      time: clean(data.time) || currentTime(),
      itemId: clean(data.itemId),
      quantity: numberValue(data.quantity),
      withdrawnBy: clean(data.withdrawnBy),
      roleRegistration: clean(data.roleRegistration),
      sector: clean(data.sector),
      purpose: clean(data.purpose),
      lot: clean(data.lot),
      expirationDate: clean(data.expirationDate),
      releasedBy: clean(data.releasedBy),
      notes: clean(data.notes),
      createdAt: data.createdAt || now,
      updatedAt: now
    };
  }

  function normalizeState(parsed) {
    return {
      items: Array.isArray(parsed.items) ? parsed.items.map(function (item) { return createItem(item, true); }).filter(function (item) { return item.name; }) : [],
      entries: Array.isArray(parsed.entries) ? parsed.entries.map(createEntry).filter(function (entry) { return entry.itemId && entry.quantity > 0; }) : [],
      exits: Array.isArray(parsed.exits) ? parsed.exits.map(createExit).filter(function (exit) { return exit.itemId && exit.quantity > 0; }) : [],
      sectors: Array.isArray(parsed.sectors) && parsed.sectors.length ? parsed.sectors.map(clean).filter(Boolean) : SECTORS.slice(),
      updatedAt: parsed.updatedAt || new Date().toISOString()
    };
  }

  function loadStockSaudeState() {
    try {
      const storage = getStorage();
      const raw = storage ? storage.getItem(STORAGE_KEY) : "";
      if (!raw) {
        const demo = buildDemoState();
        saveStockSaudeState(demo);
        return demo;
      }
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      console.warn("Nao foi possivel carregar o Stock Saude local.", error);
      return buildDemoState();
    }
  }

  function saveStockSaudeState(state) {
    const safeState = normalizeState(Object.assign({}, state, {
      updatedAt: new Date().toISOString()
    }));
    const storage = getStorage();
    if (storage) {
      storage.setItem(STORAGE_KEY, JSON.stringify(safeState));
    }
    return safeState;
  }

  function modeLabel() {
    return stockSaudeRuntimeMode === "remote" ? "Modo banco real" : "Modo demonstracao local";
  }

  function setRuntimeMode(mode) {
    stockSaudeRuntimeMode = mode === "remote" ? "remote" : "local";
    if (window.console && console.info) {
      console.info(stockSaudeRuntimeMode === "remote" ? "Stock Saude: banco real ativo." : "Stock Saude: modo local ativo.");
    }
  }

  function buildStatusMessage(message) {
    return modeLabel() + (message ? " - " + message : "");
  }

  function stockSaudeRemoteErrorMessage(error) {
    if (error && error.payload && error.payload.error === "stock_saude_database_not_configured") {
      return "Banco real indisponivel. Continuando em demonstracao local.";
    }
    if (error && error.payload && error.payload.error === "item_not_in_profile_scope") {
      return "Item fora do escopo do seu perfil. Verifique instituicao e unidade.";
    }
    if (error && error.payload && error.payload.error === "entry_not_in_profile_scope") {
      return "Entrada fora do escopo do seu perfil. Verifique instituicao e unidade.";
    }
    if (error && error.payload && error.payload.error === "permission_denied") {
      return stockSaudePermissionMessage();
    }
    return "Nao foi possivel concluir no banco real. Voce pode continuar usando a demonstracao local.";
  }

  function toRemoteItemPayload(item) {
    return {
      institution_id: getStockSaudeInstitutionId(),
      unit_id: getStockSaudeUnitId(),
      name: item.name,
      category: item.category,
      unit: item.unit,
      minimum_quantity: numberValue(item.minimumStock),
      location: item.storageLocation,
      batch: item.lot,
      expiration_date: item.expirationDate || null
    };
  }

  function toRemoteEntryPayload(entry) {
    return {
      institution_id: getStockSaudeInstitutionId(),
      unit_id: getStockSaudeUnitId(),
      item_id: entry.itemId,
      quantity: numberValue(entry.quantity),
      source: "stock_saude_app",
      invoice_number: entry.invoice,
      requested_by: getStockSaudeProfileId()
    };
  }

  function toRemoteExitPayload(exit) {
    return {
      institution_id: getStockSaudeInstitutionId(),
      unit_id: getStockSaudeUnitId(),
      item_id: exit.itemId,
      quantity: numberValue(exit.quantity),
      destination_sector: exit.sector,
      purpose: exit.purpose,
      responsible_name: exit.releasedBy || exit.withdrawnBy,
      created_by: getStockSaudeProfileId()
    };
  }

  function fromRemoteItem(item) {
    return createItem({
      id: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      quantity: 0,
      minimumStock: item.minimum_quantity,
      lot: item.batch,
      expirationDate: item.expiration_date,
      supplier: "",
      invoice: "",
      storageLocation: item.location,
      temperature: "",
      controlled: false,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }, true);
  }

  function fromRemoteEntry(entry, status) {
    return createEntry({
      id: entry.id,
      itemId: entry.item_id,
      date: String(entry.created_at || todayKey()).slice(0, 10),
      time: String(entry.created_at || "").slice(11, 16) || currentTime(),
      quantity: entry.quantity,
      lot: entry.lote || "",
      expirationDate: entry.validade || "",
      supplier: entry.fornecedor || "",
      invoice: entry.invoice_number || "",
      receivedBy: entry.responsavel || "Almoxarifado",
      notes: "Registro remoto.",
      status: status || entry.status,
      decisionAt: entry.approved_at || "",
      decisionBy: entry.approved_by ? "Gestor" : "",
      createdAt: entry.created_at,
      updatedAt: entry.approved_at || entry.created_at
    });
  }

  function fromRemoteExit(exit) {
    return createExit({
      id: exit.id,
      itemId: exit.item_id,
      date: String(exit.created_at || todayKey()).slice(0, 10),
      time: String(exit.created_at || "").slice(11, 16) || currentTime(),
      quantity: exit.quantity,
      withdrawnBy: exit.responsible_name || "",
      roleRegistration: "",
      sector: exit.destination_sector || "",
      purpose: exit.purpose || "",
      lot: "",
      expirationDate: "",
      releasedBy: exit.responsible_name || "",
      notes: "Registro remoto.",
      createdAt: exit.created_at,
      updatedAt: exit.created_at
    });
  }

  function fromRemoteAuditLog(log) {
    const createdAt = String(log.created_at || "");
    const actionLabel = stockSaudeAuditActionLabel(log.action);
    return {
      kind: stockSaudeAuditActionKind(log.action, log.entity_type),
      status: log.action || "auditoria",
      date: createdAt.slice(0, 10) || todayKey(),
      time: createdAt.slice(11, 16) || "",
      item: null,
      responsible: log.profile_name || log.profile_id || "Perfil",
      sector: "",
      title: actionLabel,
      text: "Entidade: " + (log.entity_type || "registro") + (log.entity_id ? " - " + log.entity_id : "")
    };
  }

  async function loadRemoteStockSaudeState() {
    const token = getStockSaudeAuthTokenOrThrow();
    const remoteItems = await StockSaudeAPI.listItems(token);
    const remoteEntries = await StockSaudeAPI.listEntries(token);
    const remoteExits = await StockSaudeAPI.listExits(token);
    const remoteBalance = await StockSaudeAPI.getBalance(token);
    const remoteDashboard = await StockSaudeAPI.getDashboard(token);
    const remoteAuditLog = await StockSaudeAPI.listAuditLog(token);
    stockSaudeRemoteCache.items = remoteItems.map(fromRemoteItem);
    stockSaudeRemoteCache.entries = remoteEntries.map(fromRemoteEntry);
    stockSaudeRemoteCache.exits = remoteExits.map(fromRemoteExit);
    stockSaudeRemoteCache.balance = remoteBalance;
    stockSaudeRemoteCache.dashboard = remoteDashboard;
    stockSaudeRemoteCache.auditLog = remoteAuditLog;
    return {
      items: stockSaudeRemoteCache.items,
      entries: stockSaudeRemoteCache.entries,
      exits: stockSaudeRemoteCache.exits,
      sectors: SECTORS.slice(),
      remoteBalance: remoteBalance,
      remoteDashboard: remoteDashboard,
      remoteAuditLog: remoteAuditLog,
      updatedAt: new Date().toISOString()
    };
  }

  async function loadCurrentStockSaudeState() {
    if (stockSaudeRuntimeMode !== "remote") {
      return loadStockSaudeState();
    }
    try {
      return await loadRemoteStockSaudeState();
    } catch (error) {
      setRuntimeMode("local");
      setMessage(stockSaudeRemoteErrorMessage(error));
      return loadStockSaudeState();
    }
  }

  function findItem(state, itemId) {
    return state.items.find(function (item) {
      return item.id === itemId;
    }) || null;
  }

  function approvedEntriesForItem(state, itemId) {
    return state.entries.filter(function (entry) {
      return entry.itemId === itemId && entry.status === "aprovada";
    });
  }

  function exitsForItem(state, itemId) {
    return state.exits.filter(function (exit) {
      return exit.itemId === itemId;
    });
  }

  function calculateItemBalance(state, item) {
    const approvedQuantity = approvedEntriesForItem(state, item.id).reduce(function (sum, entry) {
      return sum + numberValue(entry.quantity);
    }, 0);
    const exitQuantity = exitsForItem(state, item.id).reduce(function (sum, exit) {
      return sum + numberValue(exit.quantity);
    }, 0);
    return numberValue(item.initialQuantity) + approvedQuantity - exitQuantity;
  }

  function buildBalances(state) {
    if (Array.isArray(state.remoteBalance) && state.remoteBalance.length) {
      return state.items.map(function (item) {
        const remote = state.remoteBalance.find(function (balance) {
          return balance.item_id === item.id;
        });
        return {
          item: item,
          balance: remote ? numberValue(remote.current_quantity) : calculateItemBalance(state, item)
        };
      });
    }
    return state.items.map(function (item) {
      return {
        item: item,
        balance: calculateItemBalance(state, item)
      };
    });
  }

  function getExpirationBucket(item) {
    const days = daysUntil(item.expirationDate);
    if (days === null) {
      return null;
    }
    if (days < 0) {
      return { kind: "vencido", label: "Produto vencido", days: days };
    }
    for (const windowSize of EXPIRATION_WINDOWS) {
      if (days <= windowSize) {
        return { kind: "vence-" + windowSize, label: "Vencendo em " + windowSize + " dias", days: days };
      }
    }
    return { kind: "valido", label: "Valido", days: days };
  }

  function buildAlerts(state) {
    const alerts = [];
    buildBalances(state).forEach(function (balance) {
      const item = balance.item;
      if (balance.balance <= 0) {
        alerts.push({ type: "zerado", severity: "critical", title: "Produto zerado", message: item.name + " esta zerado." });
      } else if (numberValue(item.minimumStock) > 0 && balance.balance < numberValue(item.minimumStock)) {
        alerts.push({ type: "minimo", severity: "warning", title: "Estoque abaixo do minimo", message: item.name + " esta com " + formatNumber(balance.balance) + " " + item.unit + "." });
      }
      const expiration = getExpirationBucket(item);
      if (expiration && expiration.kind !== "valido") {
        alerts.push({ type: expiration.kind, severity: expiration.days < 0 || expiration.days <= 7 ? "critical" : "warning", title: expiration.label, message: item.name + " - validade " + formatDate(item.expirationDate) + "." });
      }
    });

    state.entries.filter(function (entry) { return entry.status === "pendente"; }).forEach(function (entry) {
      const item = findItem(state, entry.itemId);
      alerts.push({
        type: "entrada-pendente",
        severity: "info",
        title: "Entrada pendente de aprovacao",
        message: (item ? item.name : "Item") + " aguarda decisao do gestor."
      });
    });
    return alerts;
  }

  function buildDashboard(state) {
    if (state.remoteDashboard) {
      return [
        ["Total de itens", state.remoteDashboard.totalItems || 0],
        ["Estoque critico", state.remoteDashboard.lowStockItems || 0],
        ["Proximos do vencimento", state.remoteDashboard.expiringSoonItems || 0],
        ["Vencidos", state.remoteDashboard.expiredItems || 0],
        ["Entradas aguardando aprovacao", state.remoteDashboard.pendingEntries || 0],
        ["Saidas registradas", state.remoteDashboard.totalExits || 0],
        ["Entradas aprovadas", state.remoteDashboard.approvedEntries || 0],
        ["Entradas rejeitadas", state.remoteDashboard.rejectedEntries || 0],
        ["Auditorias registradas", state.remoteDashboard.auditCount || 0]
      ];
    }
    const balances = buildBalances(state);
    const alerts = buildAlerts(state);
    const today = todayKey();
    const sectors = new Set(state.exits.map(function (exit) { return clean(exit.sector); }).filter(Boolean));
    return [
      ["Total de itens", state.items.length],
      ["Estoque critico", balances.filter(function (balance) { return balance.balance > 0 && balance.balance < numberValue(balance.item.minimumStock); }).length],
      ["Proximos do vencimento", balances.filter(function (balance) { const exp = getExpirationBucket(balance.item); return exp && exp.days >= 0 && exp.days <= 90; }).length],
      ["Vencidos", balances.filter(function (balance) { const exp = getExpirationBucket(balance.item); return exp && exp.days < 0; }).length],
      ["Entradas aguardando aprovacao", state.entries.filter(function (entry) { return entry.status === "pendente"; }).length],
      ["Saidas do dia", state.exits.filter(function (exit) { return exit.date === today; }).length],
      ["Medicamentos controlados", state.items.filter(function (item) { return item.controlled || item.category === "Controlado"; }).length],
      ["Setores atendidos", sectors.size],
      ["Alertas ativos", alerts.length]
    ];
  }

  function registerStockSaudeItem(formData) {
    const state = loadStockSaudeState();
    const item = createItem(Object.fromEntries(formData.entries()));
    if (!item.name) {
      return null;
    }
    state.items.push(item);
    saveStockSaudeState(state);
    return item;
  }

  async function registerStockSaudeItemHybrid(formData) {
    const item = createItem(Object.fromEntries(formData.entries()));
    if (!item.name) {
      return null;
    }
    if (stockSaudeRuntimeMode !== "remote") {
      return registerStockSaudeItem(formData);
    }
    try {
      const remoteItem = await StockSaudeAPI.createItem(getStockSaudeAuthTokenOrThrow(), toRemoteItemPayload(item));
      const normalized = fromRemoteItem(remoteItem);
      stockSaudeRemoteCache.items.push(normalized);
      return normalized;
    } catch (error) {
      if (error && error.payload && error.payload.error === "permission_denied") {
        setMessage(stockSaudeRemoteErrorMessage(error));
        return null;
      }
      setRuntimeMode("local");
      setMessage(stockSaudeRemoteErrorMessage(error));
      return registerStockSaudeItem(formData);
    }
  }

  function registerStockSaudeEntryRequest(formData) {
    const state = loadStockSaudeState();
    const entry = createEntry(Object.assign(Object.fromEntries(formData.entries()), {
      status: "pendente"
    }));
    state.entries.push(entry);
    saveStockSaudeState(state);
    return entry;
  }

  async function registerStockSaudeEntryRequestHybrid(formData) {
    const entry = createEntry(Object.assign(Object.fromEntries(formData.entries()), {
      status: "pendente"
    }));
    if (stockSaudeRuntimeMode !== "remote") {
      return registerStockSaudeEntryRequest(formData);
    }
    try {
      const remoteEntry = await StockSaudeAPI.createEntry(getStockSaudeAuthTokenOrThrow(), toRemoteEntryPayload(entry));
      const normalized = fromRemoteEntry(remoteEntry, "pendente");
      stockSaudeRemoteCache.entries.push(normalized);
      return normalized;
    } catch (error) {
      if (error && error.payload && error.payload.error === "item_not_in_profile_scope") {
        setMessage(stockSaudeRemoteErrorMessage(error));
        return null;
      }
      if (error && error.payload && error.payload.error === "permission_denied") {
        setMessage(stockSaudeRemoteErrorMessage(error));
        return null;
      }
      setRuntimeMode("local");
      setMessage(stockSaudeRemoteErrorMessage(error));
      return registerStockSaudeEntryRequest(formData);
    }
  }

  function approveStockSaudeEntry(entryId, status) {
    const state = loadStockSaudeState();
    const entry = state.entries.find(function (candidate) {
      return candidate.id === entryId;
    });
    if (!entry) {
      return null;
    }
    entry.status = status;
    entry.decisionAt = new Date().toISOString();
    entry.decisionBy = "Gestor";
    entry.updatedAt = new Date().toISOString();
    saveStockSaudeState(state);
    return entry;
  }

  async function approveStockSaudeEntryHybrid(entryId, status) {
    if (stockSaudeRuntimeMode !== "remote") {
      return approveStockSaudeEntry(entryId, status);
    }
    if (status === "correcao_solicitada") {
      return {
        unsupported: true,
        message: "Solicitacao de correcao remota sera conectada na proxima fase. A entrada segue pendente."
      };
    }
    try {
      const token = getStockSaudeAuthTokenOrThrow();
      const remoteEntry = status === "rejeitada"
        ? await StockSaudeAPI.rejectEntry(token, entryId)
        : await StockSaudeAPI.approveEntry(token, entryId);
      const entry = stockSaudeRemoteCache.entries.find(function (candidate) {
        return candidate.id === entryId;
      });
      if (entry) {
        entry.status = remoteEntry.status || status;
        entry.decisionAt = remoteEntry.approved_at || new Date().toISOString();
        entry.decisionBy = "Gestor";
        entry.updatedAt = entry.decisionAt;
      }
      return entry || fromRemoteEntry(remoteEntry, remoteEntry.status || status);
    } catch (error) {
      if (error && error.payload && error.payload.error === "entry_not_in_profile_scope") {
        return {
          unsupported: true,
          message: stockSaudeRemoteErrorMessage(error)
        };
      }
      if (error && error.payload && error.payload.error === "permission_denied") {
        return {
          unsupported: true,
          message: stockSaudeRemoteErrorMessage(error)
        };
      }
      setRuntimeMode("local");
      setMessage(stockSaudeRemoteErrorMessage(error));
      return null;
    }
  }

  function registerStockSaudeExit(formData) {
    const state = loadStockSaudeState();
    const data = Object.fromEntries(formData.entries());
    const item = findItem(state, data.itemId);
    if (!item) {
      return { ok: false, message: "Item nao encontrado." };
    }
    const quantity = numberValue(data.quantity);
    const balance = calculateItemBalance(state, item);
    if (quantity <= 0 || quantity > balance) {
      return { ok: false, message: "Saldo insuficiente. Disponivel: " + formatNumber(balance) + " " + item.unit + "." };
    }
    const exit = createExit(data);
    state.exits.push(exit);
    saveStockSaudeState(state);
    return { ok: true, message: "Saida registrada no historico.", exit: exit };
  }

  async function registerStockSaudeExitHybrid(formData) {
    if (stockSaudeRuntimeMode !== "remote") {
      return registerStockSaudeExit(formData);
    }
    const exit = createExit(Object.fromEntries(formData.entries()));
    try {
      const remoteExit = await StockSaudeAPI.createExit(getStockSaudeAuthTokenOrThrow(), toRemoteExitPayload(exit));
      stockSaudeRemoteCache.exits.push(fromRemoteExit(remoteExit));
      return { ok: true, message: "Saida registrada no banco real.", exit: remoteExit };
    } catch (error) {
      if (error && error.payload && error.payload.error === "insufficient_stock") {
        return {
          ok: false,
          message: "Saldo insuficiente no banco real. Disponivel: " + formatNumber(error.payload.available_quantity) + "."
        };
      }
      if (error && error.payload && error.payload.error === "item_not_in_profile_scope") {
        return {
          ok: false,
          message: stockSaudeRemoteErrorMessage(error)
        };
      }
      if (error && error.payload && error.payload.error === "permission_denied") {
        return {
          ok: false,
          message: stockSaudeRemoteErrorMessage(error)
        };
      }
      setRuntimeMode("local");
      setMessage(stockSaudeRemoteErrorMessage(error));
      return registerStockSaudeExit(formData);
    }
  }

  function setMessage(message) {
    if (elements.storageStatus) {
      elements.storageStatus.textContent = buildStatusMessage(message);
    }
  }

  function renderDashboard(state) {
    if (!elements.dashboard) {
      return;
    }
    elements.dashboard.innerHTML = buildDashboard(state).map(function (card) {
      return '<article><span>' + card[0] + '</span><strong>' + card[1] + '</strong></article>';
    }).join("");
  }

  function escapeStockSaudePdfHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatStockSaudePdfDateTime(value) {
    const raw = String(value || "");
    if (!raw) {
      return "-";
    }
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("pt-BR");
    }
    return raw;
  }

  function buildStockSaudePdfTable(headers, rows, emptyText) {
    if (!rows || !rows.length) {
      return '<p class="empty">' + escapeStockSaudePdfHtml(emptyText) + '</p>';
    }
    return "<table><thead><tr>" + headers.map(function (header) {
      return "<th>" + escapeStockSaudePdfHtml(header) + "</th>";
    }).join("") + "</tr></thead><tbody>" + rows.map(function (row) {
      return "<tr>" + row.map(function (cell) {
        return "<td>" + escapeStockSaudePdfHtml(cell) + "</td>";
      }).join("") + "</tr>";
    }).join("") + "</tbody></table>";
  }

  function buildStockSaudePdfDefinitionList(items) {
    return '<dl class="list">' + items.map(function (item) {
      return "<dt>" + escapeStockSaudePdfHtml(item[0]) + "</dt><dd>" + escapeStockSaudePdfHtml(item[1]) + "</dd>";
    }).join("") + "</dl>";
  }

  function buildStockSaudeManagerPdfData(state) {
    const balances = buildBalances(state);
    const dashboard = state.remoteDashboard || {};
    const entries = state.entries.slice().sort(function (a, b) {
      return String(b.date + b.time).localeCompare(String(a.date + a.time));
    });
    const exits = state.exits.slice().sort(function (a, b) {
      return String(b.date + b.time).localeCompare(String(a.date + a.time));
    });
    const pendingEntries = entries.filter(function (entry) {
      return entry.status === "pendente";
    });
    const criticalBalances = balances.filter(function (balance) {
      return balance.balance <= 0 || (numberValue(balance.item.minimumStock) > 0 && balance.balance < numberValue(balance.item.minimumStock));
    });
    const auditRows = Array.isArray(state.remoteAuditLog)
      ? state.remoteAuditLog.map(fromRemoteAuditLog)
      : buildHistoryRows(state).filter(function (row) {
        return ["entrada", "saida", "aprovacao", "item"].indexOf(row.kind) >= 0;
      });

    return {
      profile: {
        institution: getStockSaudeInstitutionId(),
        unit: getStockSaudeUnitId(),
        issuer: clean(stockSaudeAuthContext.profile && stockSaudeAuthContext.profile.name) || clean(stockSaudeAuthContext.user && stockSaudeAuthContext.user.email) || "Perfil local",
        role: clean(stockSaudeAuthContext.profile && stockSaudeAuthContext.profile.role) || "local",
        emittedAt: new Date().toLocaleString("pt-BR")
      },
      stats: [
        ["Itens", dashboard.totalItems != null ? dashboard.totalItems : state.items.length],
        ["Entradas", dashboard.totalEntries != null ? dashboard.totalEntries : state.entries.length],
        ["Saidas", dashboard.totalExits != null ? dashboard.totalExits : state.exits.length],
        ["Pendentes", dashboard.pendingEntries != null ? dashboard.pendingEntries : pendingEntries.length],
        ["Criticos", dashboard.lowStockItems != null ? dashboard.lowStockItems : criticalBalances.length],
        ["Auditorias", dashboard.auditCount != null ? dashboard.auditCount : auditRows.length]
      ],
      summary: [
        ["Resumo executivo", "Relatorio gerencial consolidado do Stock Saude para acompanhamento de estoque, movimentacoes, pendencias e auditoria operacional."],
        ["Modo de dados", stockSaudeRuntimeMode === "remote" ? "Supabase autenticado" : "Demonstracao local"],
        ["Saldo total", formatNumber(dashboard.totalBalance != null ? dashboard.totalBalance : balances.reduce(function (sum, balance) { return sum + numberValue(balance.balance); }, 0))],
        ["Itens vencidos", dashboard.expiredItems != null ? dashboard.expiredItems : buildAlerts(state).filter(function (alert) { return alert.type === "vencido"; }).length],
        ["Itens proximos do vencimento", dashboard.expiringSoonItems != null ? dashboard.expiringSoonItems : buildAlerts(state).filter(function (alert) { return String(alert.type || "").indexOf("vence-") === 0; }).length]
      ],
      criticalItems: criticalBalances.slice(0, 12).map(function (balance) {
        return [
          balance.item.name,
          formatNumber(balance.balance) + " " + balance.item.unit,
          formatNumber(balance.item.minimumStock),
          balance.balance <= 0 ? "Zerado" : "Critico",
          balance.item.storageLocation || "-"
        ];
      }),
      recentEntries: entries.slice(0, 10).map(function (entry) {
        const item = findItem(state, entry.itemId);
        return [
          formatDate(entry.date) + (entry.time ? " " + entry.time : ""),
          item ? item.name : "Item",
          formatNumber(entry.quantity),
          statusLabel(entry.status),
          entry.receivedBy || "-"
        ];
      }),
      recentExits: exits.slice(0, 10).map(function (exit) {
        const item = findItem(state, exit.itemId);
        return [
          formatDate(exit.date) + (exit.time ? " " + exit.time : ""),
          item ? item.name : "Item",
          formatNumber(exit.quantity),
          exit.sector || "-",
          exit.withdrawnBy || exit.releasedBy || "-"
        ];
      }),
      pendingEntries: pendingEntries.slice(0, 10).map(function (entry) {
        const item = findItem(state, entry.itemId);
        return [
          formatDate(entry.date) + (entry.time ? " " + entry.time : ""),
          item ? item.name : "Item",
          formatNumber(entry.quantity),
          entry.receivedBy || "-",
          "Pendente"
        ];
      }),
      auditRows: auditRows.slice(0, 12).map(function (row) {
        return [
          formatDate(row.date) + (row.time ? " " + row.time : ""),
          row.responsible || "-",
          row.title,
          row.text
        ];
      })
    };
  }

  function buildStockSaudeManagerPdfHtml_(data) {
    const title = "Relatorio Gerencial - Stock Saude";
    const subtitle = "Controle de estoque, movimentacoes, pendencias e auditoria operacional";
    return "<!doctype html><html><head><meta charset=\"utf-8\">" +
      "<title>" + escapeStockSaudePdfHtml(title) + "</title>" +
      "<style>" +
      "body{font-family:Arial,sans-serif;margin:0;padding:28px;color:#102033;background:#f6f8fb}" +
      ".page{max-width:980px;margin:0 auto;background:#fff;border:1px solid #dbe4ee;padding:28px}" +
      ".cover{border:1px solid #cbd8e6;padding:26px;margin-bottom:18px;background:linear-gradient(135deg,#fff,#f3fbff)}" +
      "h1{margin:0 0 6px;font-size:26px}h2{margin:24px 0 10px;font-size:16px;color:#0f5f8f}.sub{color:#607080;margin:0}" +
      ".meta,.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.meta div,.stat{border:1px solid #e2e8f0;padding:10px;border-radius:8px}.stat span{display:block;color:#607080;font-size:11px;text-transform:uppercase;font-weight:700}.stat strong{display:block;font-size:20px;margin-top:4px}" +
      ".section{border-top:1px solid #e2e8f0;margin-top:18px;padding-top:14px}.list{display:grid;grid-template-columns:210px 1fr;gap:6px 12px}.list dt{font-weight:700}.list dd{margin:0;color:#405062}" +
      "table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #e2e8f0;padding:8px;text-align:left;font-size:12px}th{background:#f6f9fc;color:#102033}.empty{color:#607080}footer{margin-top:22px;color:#607080;font-size:12px}@media print{body{background:#fff;padding:0}.page{border:0}.section{break-inside:avoid}}" +
      "</style></head><body><main class=\"page\">" +
      "<section class=\"cover\"><h1>" + escapeStockSaudePdfHtml(title) + "</h1><p class=\"sub\">" + escapeStockSaudePdfHtml(subtitle) + "</p></section>" +
      "<section class=\"meta\">" +
      "<div><strong>Instituicao</strong><br>" + escapeStockSaudePdfHtml(data.profile.institution) + "</div>" +
      "<div><strong>Unidade</strong><br>" + escapeStockSaudePdfHtml(data.profile.unit) + "</div>" +
      "<div><strong>Emissor</strong><br>" + escapeStockSaudePdfHtml(data.profile.issuer) + " (" + escapeStockSaudePdfHtml(data.profile.role) + ")</div>" +
      "</section>" +
      "<p class=\"sub\">Emitido em " + escapeStockSaudePdfHtml(data.profile.emittedAt) + "</p>" +
      "<section class=\"stats\">" + data.stats.map(function (stat) {
        return "<article class=\"stat\"><span>" + escapeStockSaudePdfHtml(stat[0]) + "</span><strong>" + escapeStockSaudePdfHtml(stat[1]) + "</strong></article>";
      }).join("") + "</section>" +
      "<section class=\"section\"><h2>Resumo executivo</h2>" + buildStockSaudePdfDefinitionList(data.summary) + "</section>" +
      "<section class=\"section\"><h2>Itens criticos</h2>" + buildStockSaudePdfTable(["Item", "Saldo", "Minimo", "Status", "Local"], data.criticalItems, "Nenhum item critico encontrado.") + "</section>" +
      "<section class=\"section\"><h2>Entradas recentes</h2>" + buildStockSaudePdfTable(["Data/hora", "Item", "Quantidade", "Status", "Responsavel"], data.recentEntries, "Nenhuma entrada recente.") + "</section>" +
      "<section class=\"section\"><h2>Saidas recentes</h2>" + buildStockSaudePdfTable(["Data/hora", "Item", "Quantidade", "Setor", "Responsavel"], data.recentExits, "Nenhuma saida recente.") + "</section>" +
      "<section class=\"section\"><h2>Pendencias</h2>" + buildStockSaudePdfTable(["Data/hora", "Item", "Quantidade", "Responsavel", "Status"], data.pendingEntries, "Nenhuma pendencia em aberto.") + "</section>" +
      "<section class=\"section\"><h2>Historico operacional / auditoria recente</h2>" + buildStockSaudePdfTable(["Data/hora", "Usuario", "Acao", "Entidade afetada"], data.auditRows, "Nenhuma auditoria recente.") + "</section>" +
      "<footer>Gerado por Stock Saude / ObraReport.</footer>" +
      "<script>window.onload=function(){window.print();};</script>" +
      "</main></body></html>";
  }

  async function generateStockSaudeManagementPdf() {
    try {
      const state = await loadCurrentStockSaudeState();
      const data = buildStockSaudeManagerPdfData(state);
      const html = buildStockSaudeManagerPdfHtml_(data);
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        window.location.href = URL.createObjectURL(blob);
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      setMessage("PDF gerencial aberto. Use Imprimir/Salvar como PDF no navegador.");
    } catch (error) {
      setMessage("Nao foi possivel gerar o PDF gerencial.");
    }
  }

  function buildStockSaudeExportTables(state) {
    const balances = buildBalances(state);
    const balanceByItemId = new Map();
    balances.forEach(function (balance) {
      balanceByItemId.set(balance.item.id, balance.balance);
    });
    return [
      {
        title: "Itens",
        headers: ["Nome", "Categoria", "Unidade", "Saldo", "Minimo", "Local"],
        rows: state.items.map(function (item) {
          return [
            item.name,
            item.category,
            item.unit,
            formatNumber(balanceByItemId.has(item.id) ? balanceByItemId.get(item.id) : calculateItemBalance(state, item)),
            formatNumber(item.minimumStock),
            item.storageLocation || "-"
          ];
        })
      },
      {
        title: "Entradas",
        headers: ["Data", "Item", "Quantidade", "Status", "Responsavel"],
        rows: state.entries.map(function (entry) {
          const item = findItem(state, entry.itemId);
          return [
            formatDate(entry.date) + (entry.time ? " " + entry.time : ""),
            item ? item.name : "Item",
            formatNumber(entry.quantity),
            statusLabel(entry.status),
            entry.receivedBy || "-"
          ];
        })
      },
      {
        title: "Saidas",
        headers: ["Data", "Item", "Quantidade", "Responsavel"],
        rows: state.exits.map(function (exit) {
          const item = findItem(state, exit.itemId);
          return [
            formatDate(exit.date) + (exit.time ? " " + exit.time : ""),
            item ? item.name : "Item",
            formatNumber(exit.quantity),
            exit.withdrawnBy || exit.releasedBy || "-"
          ];
        })
      }
    ];
  }

  function escapeStockSaudeCsvCell(value) {
    return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
  }

  function buildStockSaudeCsvContent(state) {
    return buildStockSaudeExportTables(state).map(function (table) {
      return [
        table.title,
        table.headers.map(escapeStockSaudeCsvCell).join(";")
      ].concat(table.rows.map(function (row) {
        return row.map(escapeStockSaudeCsvCell).join(";");
      })).join("\n");
    }).join("\n\n");
  }

  function buildStockSaudeExcelContent(state) {
    return "<!doctype html><html><head><meta charset=\"utf-8\"></head><body>" +
      "<h1>Relatorio Operacional - Stock Saude</h1>" +
      buildStockSaudeExportTables(state).map(function (table) {
        return "<h2>" + escapeStockSaudePdfHtml(table.title) + "</h2><table border=\"1\"><thead><tr>" +
          table.headers.map(function (header) { return "<th>" + escapeStockSaudePdfHtml(header) + "</th>"; }).join("") +
          "</tr></thead><tbody>" + table.rows.map(function (row) {
            return "<tr>" + row.map(function (cell) { return "<td>" + escapeStockSaudePdfHtml(cell) + "</td>"; }).join("") + "</tr>";
          }).join("") + "</tbody></table>";
      }).join("") + "</body></html>";
  }

  function downloadStockSaudeFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 250);
  }

  async function exportStockSaudeCsv() {
    const state = await loadCurrentStockSaudeState();
    downloadStockSaudeFile(buildStockSaudeCsvContent(state), "stock-saude-operacional.csv", "text/csv;charset=utf-8");
    setMessage("CSV operacional exportado.");
  }

  async function exportStockSaudeExcel() {
    const state = await loadCurrentStockSaudeState();
    downloadStockSaudeFile(buildStockSaudeExcelContent(state), "stock-saude-operacional.xls", "application/vnd.ms-excel;charset=utf-8");
    setMessage("Excel operacional exportado.");
  }

  function ensureStockSaudeManagementPdfButton() {
    if (!elements.storageStatus || document.getElementById("stockSaudeManagerPdfButton")) {
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.id = "stockSaudeManagerPdfButton";
    button.className = "stock-mini-button";
    button.textContent = "Gerar PDF Gerencial";
    button.addEventListener("click", generateStockSaudeManagementPdf);
    elements.storageStatus.parentNode.insertBefore(button, elements.storageStatus.nextSibling);
  }

  function ensureStockSaudeExportButtons() {
    if (!elements.storageStatus || document.getElementById("stockSaudeExportCsvButton")) {
      return;
    }
    const csvButton = document.createElement("button");
    csvButton.type = "button";
    csvButton.id = "stockSaudeExportCsvButton";
    csvButton.className = "stock-mini-button";
    csvButton.textContent = "Exportar CSV";
    csvButton.addEventListener("click", exportStockSaudeCsv);

    const excelButton = document.createElement("button");
    excelButton.type = "button";
    excelButton.id = "stockSaudeExportExcelButton";
    excelButton.className = "stock-mini-button";
    excelButton.textContent = "Exportar Excel";
    excelButton.addEventListener("click", exportStockSaudeExcel);

    const anchor = document.getElementById("stockSaudeManagerPdfButton") || elements.storageStatus;
    anchor.parentNode.insertBefore(csvButton, anchor.nextSibling);
    csvButton.parentNode.insertBefore(excelButton, csvButton.nextSibling);
  }

  function renderSelects(state) {
    document.querySelectorAll("[data-stock-saude-item-select]").forEach(function (select) {
      const current = select.value;
      select.innerHTML = '<option value="">Selecione</option>' + state.items.map(function (item) {
        return '<option value="' + item.id + '">' + item.name + ' (' + item.unit + ')</option>';
      }).join("");
      if (current) {
        select.value = current;
      }
    });
    if (elements.sectorSelect) {
      elements.sectorSelect.innerHTML = state.sectors.map(function (sector) {
        return '<option>' + sector + '</option>';
      }).join("");
    }
  }

  function renderApprovals(state) {
    if (!elements.approvals) {
      return;
    }
    if (!canStockSaudeRole("approve_entry") && !canStockSaudeRole("reject_entry")) {
      elements.approvals.innerHTML = '<p class="stock-empty">Seu perfil pode consultar entradas, mas nao aprovar ou rejeitar.</p>';
      return;
    }
    const pending = state.entries.filter(function (entry) {
      return entry.status === "pendente";
    }).sort(function (a, b) {
      return String(b.date + b.time).localeCompare(String(a.date + a.time));
    });
    if (!pending.length) {
      elements.approvals.innerHTML = '<p class="stock-empty">Nenhuma entrada pendente.</p>';
      return;
    }
    elements.approvals.innerHTML = pending.map(function (entry) {
      const item = findItem(state, entry.itemId);
      return '<article class="stock-list-card">' +
        '<div><strong>' + (item ? item.name : "Item removido") + '</strong><span>' + formatNumber(entry.quantity) + ' ' + (item ? item.unit : "un") + ' - lote ' + entry.lot + ' - validade ' + formatDate(entry.expirationDate) + '</span></div>' +
        '<small>Responsavel: ' + (entry.receivedBy || "-") + ' - ' + formatDate(entry.date) + ' ' + entry.time + '</small>' +
        '<div class="stock-card-actions">' +
          '<button type="button" data-approval-action="aprovada" data-entry-id="' + entry.id + '"' + (canStockSaudeRole("approve_entry") ? "" : " disabled") + '>Aprovar</button>' +
          '<button type="button" data-approval-action="rejeitada" data-entry-id="' + entry.id + '"' + (canStockSaudeRole("reject_entry") ? "" : " disabled") + '>Rejeitar</button>' +
          '<button type="button" data-approval-action="correcao_solicitada" data-entry-id="' + entry.id + '">Solicitar correcao</button>' +
        '</div>' +
      '</article>';
    }).join("");
  }

  function renderAlerts(state) {
    if (!elements.alerts) {
      return;
    }
    const alerts = buildAlerts(state);
    if (!alerts.length) {
      elements.alerts.innerHTML = '<p class="stock-empty">Nenhum alerta ativo.</p>';
      return;
    }
    elements.alerts.innerHTML = alerts.map(function (alert) {
      return '<article class="stock-alert ' + alert.severity + '"><strong>' + alert.title + '</strong><span>' + alert.message + '</span></article>';
    }).join("");
  }

  function buildHistoryRows(state) {
    if (Array.isArray(state.remoteAuditLog)) {
      return state.remoteAuditLog.map(fromRemoteAuditLog);
    }
    const rows = [];
    state.entries.forEach(function (entry) {
      const item = findItem(state, entry.itemId);
      rows.push({
        kind: "entrada",
        status: entry.status,
        date: entry.date,
        time: entry.time,
        item: item,
        responsible: entry.receivedBy,
        sector: "",
        title: "Entrada " + statusLabel(entry.status),
        text: (item ? item.name : "Item") + " - " + formatNumber(entry.quantity) + " " + (item ? item.unit : "un") + " - lote " + entry.lot + " - NF " + entry.invoice
      });
    });
    state.exits.forEach(function (exit) {
      const item = findItem(state, exit.itemId);
      rows.push({
        kind: "saida",
        status: "saida",
        date: exit.date,
        time: exit.time,
        item: item,
        responsible: exit.withdrawnBy || exit.releasedBy,
        sector: exit.sector,
        title: "Saida",
        text: (item ? item.name : "Item") + " - " + formatNumber(exit.quantity) + " " + (item ? item.unit : "un") + " - " + exit.sector + " - " + exit.purpose
      });
    });
    buildBalances(state).forEach(function (balance) {
      const exp = getExpirationBucket(balance.item);
      if (exp && exp.kind !== "valido") {
        rows.push({
          kind: "vencimento",
          status: exp.kind,
          date: balance.item.expirationDate,
          time: "",
          item: balance.item,
          responsible: "",
          sector: balance.item.storageLocation,
          title: exp.label,
          text: balance.item.name + " - validade " + formatDate(balance.item.expirationDate)
        });
      }
      if (balance.balance <= 0 || (numberValue(balance.item.minimumStock) > 0 && balance.balance < numberValue(balance.item.minimumStock))) {
        rows.push({
          kind: "critico",
          status: "critico",
          date: todayKey(),
          time: "",
          item: balance.item,
          responsible: "",
          sector: balance.item.storageLocation,
          title: balance.balance <= 0 ? "Produto zerado" : "Estoque critico",
          text: balance.item.name + " - saldo " + formatNumber(balance.balance) + " " + balance.item.unit
        });
      }
    });
    return rows.sort(function (a, b) {
      return String(b.date + b.time).localeCompare(String(a.date + a.time));
    });
  }

  function statusLabel(status) {
    const labels = {
      pendente: "pendente",
      aprovada: "aprovada",
      rejeitada: "rejeitada",
      correcao_solicitada: "com correcao solicitada"
    };
    return labels[status] || status;
  }

  function stockSaudeAuditActionLabel(action) {
    const labels = {
      create_item: "Criou item",
      item_created: "Criou item",
      create_entry: "Registrou entrada",
      entry_created: "Registrou entrada",
      create_exit: "Registrou saida",
      exit_created: "Registrou saida",
      approve_entry: "Aprovou entrada",
      reject_entry: "Rejeitou entrada"
    };
    return labels[action] || "Historico Operacional";
  }

  function stockSaudeAuditActionKind(action, entityType) {
    if (action === "create_item" || action === "item_created" || entityType === "stock_items") {
      return "item";
    }
    if (action === "create_entry" || action === "entry_created") {
      return "entrada";
    }
    if (action === "create_exit" || action === "exit_created" || entityType === "stock_exits") {
      return "saida";
    }
    if (action === "approve_entry" || action === "reject_entry") {
      return "aprovacao";
    }
    return "auditoria";
  }

  function passesHistoryFilter(row) {
    if (activeHistoryFilter === "todos") {
      return true;
    }
    if (activeHistoryFilter === "entradas") {
      return row.kind === "entrada";
    }
    if (activeHistoryFilter === "saidas") {
      return row.kind === "saida";
    }
    if (activeHistoryFilter === "aprovacoes") {
      return row.kind === "aprovacao";
    }
    if (activeHistoryFilter === "itens") {
      return row.kind === "item";
    }
    if (activeHistoryFilter === "pendentes") {
      return row.status === "pendente";
    }
    if (activeHistoryFilter === "aprovadas") {
      return row.status === "aprovada";
    }
    if (activeHistoryFilter === "rejeitadas") {
      return row.status === "rejeitada";
    }
    if (activeHistoryFilter === "vencimentos") {
      return row.kind === "vencimento";
    }
    if (activeHistoryFilter === "critico") {
      return row.kind === "critico";
    }
    return true;
  }

  function renderHistory(state) {
    if (!elements.history) {
      return;
    }
    const sectorFilter = normalizeText(elements.filterSector ? elements.filterSector.value : "");
    const responsibleFilter = normalizeText(elements.filterResponsible ? elements.filterResponsible.value : "");
    const rows = buildHistoryRows(state).filter(passesHistoryFilter).filter(function (row) {
      const sectorOk = !sectorFilter || normalizeText(row.sector).indexOf(sectorFilter) >= 0;
      const responsibleOk = !responsibleFilter || normalizeText(row.responsible).indexOf(responsibleFilter) >= 0;
      return sectorOk && responsibleOk;
    });
    if (!rows.length) {
      elements.history.innerHTML = '<p class="stock-empty">Nenhum registro encontrado para os filtros.</p>';
      return;
    }
    elements.history.innerHTML = rows.map(function (row) {
      return '<article class="stock-history-card">' +
        '<strong>' + row.title + '</strong>' +
        '<span>' + row.text + '</span>' +
        '<small>' + formatDate(row.date) + (row.time ? " " + row.time : "") + (row.responsible ? " - " + row.responsible : "") + (row.sector ? " - " + row.sector : "") + '</small>' +
      '</article>';
    }).join("");
  }

  async function renderAll() {
    const state = await loadCurrentStockSaudeState();
    renderDashboard(state);
    renderSelects(state);
    renderApprovals(state);
    renderAlerts(state);
    renderHistory(state);
  }

  function resetFormDateTime(form) {
    if (!form) {
      return;
    }
    const date = form.querySelector('input[name="date"]');
    const time = form.querySelector('input[name="time"]');
    if (date && !date.value) {
      date.value = todayKey();
    }
    if (time && !time.value) {
      time.value = currentTime();
    }
  }

  function bindForms() {
    if (elements.itemForm) {
      elements.itemForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!canStockSaudeRole("create_item")) {
          setMessage(stockSaudePermissionMessage());
          return;
        }
        const item = await registerStockSaudeItemHybrid(new FormData(elements.itemForm));
        if (item) {
          elements.itemForm.reset();
          setMessage("Item cadastrado no Stock Saude.");
        }
        await renderAll();
      });
    }

    if (elements.entryForm) {
      elements.entryForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!canStockSaudeRole("create_entry")) {
          setMessage(stockSaudePermissionMessage());
          return;
        }
        const entry = await registerStockSaudeEntryRequestHybrid(new FormData(elements.entryForm));
        if (entry) {
          elements.entryForm.reset();
          resetFormDateTime(elements.entryForm);
          setMessage("Entrada enviada para aprovacao. Ela ainda nao soma no estoque.");
        }
        await renderAll();
      });
    }

    if (elements.exitForm) {
      elements.exitForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!canStockSaudeRole("create_exit")) {
          setMessage(stockSaudePermissionMessage());
          return;
        }
        const result = await registerStockSaudeExitHybrid(new FormData(elements.exitForm));
        if (result.ok) {
          elements.exitForm.reset();
          resetFormDateTime(elements.exitForm);
        }
        setMessage(result.message);
        await renderAll();
      });
    }

    if (elements.approvals) {
      elements.approvals.addEventListener("click", async function (event) {
        const button = event.target.closest("[data-approval-action]");
        if (!button) {
          return;
        }
        if (button.dataset.approvalAction === "aprovada" && !canStockSaudeRole("approve_entry")) {
          setMessage(stockSaudePermissionMessage());
          return;
        }
        if (button.dataset.approvalAction === "rejeitada" && !canStockSaudeRole("reject_entry")) {
          setMessage(stockSaudePermissionMessage());
          return;
        }
        const decision = await approveStockSaudeEntryHybrid(button.dataset.entryId, button.dataset.approvalAction);
        setMessage(decision && decision.unsupported ? decision.message : "Decisao registrada: " + statusLabel(button.dataset.approvalAction) + ".");
        await renderAll();
      });
    }

    document.querySelectorAll("[data-stock-filter]").forEach(function (button) {
      button.addEventListener("click", async function () {
        activeHistoryFilter = button.dataset.stockFilter || "todos";
        document.querySelectorAll("[data-stock-filter]").forEach(function (candidate) {
          candidate.classList.toggle("active", candidate === button);
        });
        await renderAll();
      });
    });

    [elements.filterSector, elements.filterResponsible].forEach(function (input) {
      if (input) {
        input.addEventListener("input", function () {
          renderAll();
        });
      }
    });

    if (elements.resetDemo) {
      elements.resetDemo.addEventListener("click", async function () {
        saveStockSaudeState(buildDemoState());
        setMessage("Dados demo restaurados.");
        await renderAll();
      });
    }
  }

  function bindAnchorsAndReveal() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener("click", function (event) {
        const targetId = anchor.getAttribute("href");
        if (!targetId || targetId === "#") {
          return;
        }
        const target = document.querySelector(targetId);
        if (!target) {
          return;
        }
        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    const revealItems = document.querySelectorAll(".stock-profile-grid article, .stock-flow-grid article, .stock-control-grid article, .stock-audit-card span, .stock-app-dashboard article, .stock-panel");
    if ("IntersectionObserver" in window) {
      revealItems.forEach(function (item) { item.classList.add("sf-reveal"); });
      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
      revealItems.forEach(function (item) { observer.observe(item); });
    } else {
      revealItems.forEach(function (item) { item.classList.add("is-visible"); });
    }
  }

  async function init() {
    loadStockSaudeState();
    const authContext = await initStockSaudeAuthContext();
    const remoteAvailable = await StockSaudeAPI.isRemoteAvailable();
    setRuntimeMode(remoteAvailable && authContext.mode === "supabase" ? "remote" : "local");
    bindAnchorsAndReveal();
    bindForms();
    ensureStockSaudeManagementPdfButton();
    ensureStockSaudeExportButtons();
    resetFormDateTime(elements.entryForm);
    resetFormDateTime(elements.exitForm);
    setMessage(stockSaudeRuntimeMode === "remote" ? "Conectado ao backend Stock Saude." : "Estado local pronto.");
    await renderAll();
  }

  init();
})();
