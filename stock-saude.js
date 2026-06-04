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
    balance: []
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

    async approveEntry(entryId, approvedBy) {
      const data = await this.request("/api/stock-saude/entries/" + encodeURIComponent(entryId) + "/approve", {
        method: "POST",
        body: JSON.stringify({ approved_by: approvedBy || STOCK_SAUDE_DEMO_PROFILE_ID })
      });
      return data.entry;
    },

    async rejectEntry(entryId, approvedBy) {
      const data = await this.request("/api/stock-saude/entries/" + encodeURIComponent(entryId) + "/reject", {
        method: "POST",
        body: JSON.stringify({ approved_by: approvedBy || STOCK_SAUDE_DEMO_PROFILE_ID })
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

    async getBalance() {
      const params = new URLSearchParams({
        institution_id: getStockSaudeInstitutionId(),
        unit_id: getStockSaudeUnitId()
      });
      const data = await this.request("/api/stock-saude/balance?" + params.toString(), {
        method: "GET"
      });
      return data.balance || [];
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

  async function loadRemoteStockSaudeState() {
    const token = getStockSaudeAuthTokenOrThrow();
    const remoteItems = await StockSaudeAPI.listItems(token);
    const remoteEntries = await StockSaudeAPI.listEntries(token);
    const remoteExits = await StockSaudeAPI.listExits(token);
    const remoteBalance = await StockSaudeAPI.getBalance();
    stockSaudeRemoteCache.items = remoteItems.map(fromRemoteItem);
    stockSaudeRemoteCache.entries = remoteEntries.map(fromRemoteEntry);
    stockSaudeRemoteCache.exits = remoteExits.map(fromRemoteExit);
    stockSaudeRemoteCache.balance = remoteBalance;
    return {
      items: stockSaudeRemoteCache.items,
      entries: stockSaudeRemoteCache.entries,
      exits: stockSaudeRemoteCache.exits,
      sectors: SECTORS.slice(),
      remoteBalance: remoteBalance,
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
      const remoteEntry = status === "rejeitada"
        ? await StockSaudeAPI.rejectEntry(entryId, getStockSaudeProfileId())
        : await StockSaudeAPI.approveEntry(entryId, getStockSaudeProfileId());
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
          '<button type="button" data-approval-action="aprovada" data-entry-id="' + entry.id + '">Aprovar</button>' +
          '<button type="button" data-approval-action="rejeitada" data-entry-id="' + entry.id + '">Rejeitar</button>' +
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

  function passesHistoryFilter(row) {
    if (activeHistoryFilter === "entradas") {
      return row.kind === "entrada";
    }
    if (activeHistoryFilter === "saidas") {
      return row.kind === "saida";
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
        await registerStockSaudeItemHybrid(new FormData(elements.itemForm));
        elements.itemForm.reset();
        setMessage("Item cadastrado no Stock Saude.");
        await renderAll();
      });
    }

    if (elements.entryForm) {
      elements.entryForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        await registerStockSaudeEntryRequestHybrid(new FormData(elements.entryForm));
        elements.entryForm.reset();
        resetFormDateTime(elements.entryForm);
        setMessage("Entrada enviada para aprovacao. Ela ainda nao soma no estoque.");
        await renderAll();
      });
    }

    if (elements.exitForm) {
      elements.exitForm.addEventListener("submit", async function (event) {
        event.preventDefault();
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
    resetFormDateTime(elements.entryForm);
    resetFormDateTime(elements.exitForm);
    setMessage(stockSaudeRuntimeMode === "remote" ? "Conectado ao backend Stock Saude." : "Estado local pronto.");
    await renderAll();
  }

  init();
})();
