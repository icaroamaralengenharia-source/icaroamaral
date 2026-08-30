const VALUE_TYPES = new Set(["boolean", "text", "number", "percentage", "currency", "range", "date", "enum"]);
const CATEGORIES = new Set(["administracao", "documentacao", "fiscalizacao", "infraestrutura"]);
const BOOLEAN_TRUE = new Set(["sim", "s", "true", "1", "yes", "y"]);
const BOOLEAN_FALSE = new Set(["nao", "não", "n", "false", "0", "no"]);
const UNIT_BY_VALUE_TYPE = {
  boolean: new Set([""]),
  text: new Set([""]),
  number: new Set(["", "un", "dias"]),
  percentage: new Set(["%"]),
  currency: new Set(["BRL"]),
  range: new Set(["", "un"]),
  date: new Set([""]),
  enum: new Set([""])
};

const MUNICIPAL_PROFILE_CATALOG = [
  {
    code: "MUN_ADM_001",
    name: "Nome da instituicao municipal",
    description: "Identificacao textual da prefeitura ou orgao municipal responsavel pelo perfil.",
    category: "administracao",
    valueType: "text",
    unit: "",
    allowedValues: [],
    aliases: ["prefeitura", "instituicao", "orgao municipal", "municipio responsavel"],
    required: true,
    active: true
  },
  {
    code: "MUN_ADM_002",
    name: "Unidade operacional obrigatoria",
    description: "Indica se o registro exige vinculacao a uma unidade operacional ou almoxarifado.",
    category: "administracao",
    valueType: "boolean",
    unit: "",
    allowedValues: [],
    aliases: ["unidade obrigatoria", "almoxarifado obrigatorio", "unidade vinculada"],
    required: false,
    active: true
  },
  {
    code: "MUN_ADM_003",
    name: "Endereco da unidade",
    description: "Campo textual para endereco de unidade municipal quando exigido pelo documento.",
    category: "administracao",
    valueType: "text",
    unit: "",
    allowedValues: [],
    aliases: ["endereco", "localizacao da unidade", "endereco do almoxarifado"],
    required: false,
    active: true
  },
  {
    code: "MUN_DOC_001",
    name: "Tipo de documento municipal",
    description: "Classificacao documental usada pelo acervo municipal existente.",
    category: "documentacao",
    valueType: "enum",
    unit: "",
    allowedValues: ["inventario", "inspecao", "conferencia", "prestacao_contas", "nota", "termo", "relatorio", "outro"],
    aliases: ["tipo de documento", "documento", "relatorio", "termo", "inventario", "prestacao de contas"],
    required: true,
    active: true
  },
  {
    code: "MUN_DOC_002",
    name: "Relatorio obrigatorio",
    description: "Indica exigencia de relatorio ativo para a unidade ou operacao municipal.",
    category: "documentacao",
    valueType: "boolean",
    unit: "",
    allowedValues: [],
    aliases: ["relatorio obrigatorio", "relatorio ativo", "documento obrigatorio", "relatorio ausente"],
    required: false,
    active: true
  },
  {
    code: "MUN_DOC_003",
    name: "Acervo digital ativo",
    description: "Indica se o documento deve permanecer ativo no acervo municipal.",
    category: "documentacao",
    valueType: "boolean",
    unit: "",
    allowedValues: [],
    aliases: ["acervo ativo", "documento ativo", "arquivo ativo", "acervo municipal"],
    required: false,
    active: true
  },
  {
    code: "MUN_DOC_004",
    name: "Versao documental atual",
    description: "Numero da versao corrente associada ao documento municipal.",
    category: "documentacao",
    valueType: "number",
    unit: "un",
    allowedValues: [],
    aliases: ["versao", "versao atual", "current version", "numero da versao"],
    required: false,
    active: true
  },
  {
    code: "MUN_DOC_005",
    name: "Data de referencia do documento",
    description: "Data usada como referencia tecnica ou administrativa do documento importado.",
    category: "documentacao",
    valueType: "date",
    unit: "",
    allowedValues: [],
    aliases: ["data de referencia", "data do documento", "periodo", "competencia"],
    required: false,
    active: true
  },
  {
    code: "MUN_INF_001",
    name: "Quantidade minima de estoque",
    description: "Limite minimo cadastrado para controle de saldo municipal.",
    category: "infraestrutura",
    valueType: "number",
    unit: "un",
    allowedValues: [],
    aliases: ["estoque minimo", "quantidade minima", "saldo minimo", "minimum quantity"],
    required: false,
    active: true
  },
  {
    code: "MUN_INF_002",
    name: "Periodo maximo sem movimentacao",
    description: "Quantidade de dias usada para identificar ausencia de movimentacao operacional.",
    category: "infraestrutura",
    valueType: "number",
    unit: "dias",
    allowedValues: [],
    aliases: ["sem movimentacao", "periodo sem movimento", "dias sem movimentacao", "movement days"],
    required: false,
    active: true
  },
  {
    code: "MUN_INF_003",
    name: "Faixa de saldo operacional",
    description: "Faixa esperada para saldo disponivel de item municipal quando o PDF trouxer limites minimo e maximo.",
    category: "infraestrutura",
    valueType: "range",
    unit: "un",
    allowedValues: [],
    aliases: ["faixa de saldo", "limite de saldo", "saldo minimo e maximo", "intervalo operacional"],
    required: false,
    active: true
  },
  {
    code: "MUN_FIS_001",
    name: "Saida maior que saldo disponivel",
    description: "Flag para regra de fiscalizacao quando a saida supera o saldo antes da movimentacao.",
    category: "fiscalizacao",
    valueType: "boolean",
    unit: "",
    allowedValues: [],
    aliases: ["saida maior que saldo", "saldo insuficiente", "saida superior ao saldo", "excede saldo"],
    required: false,
    active: true
  },
  {
    code: "MUN_FIS_002",
    name: "Justificativa de movimentacao obrigatoria",
    description: "Indica exigencia de justificativa operacional para movimentacoes municipais.",
    category: "fiscalizacao",
    valueType: "boolean",
    unit: "",
    allowedValues: [],
    aliases: ["justificativa obrigatoria", "motivo da movimentacao", "movimentacao sem justificativa", "reason required"],
    required: false,
    active: true
  },
  {
    code: "MUN_FIS_003",
    name: "Percentual tolerado de divergencia",
    description: "Percentual maximo tolerado para divergencias em conferencia, inventario ou fiscalizacao.",
    category: "fiscalizacao",
    valueType: "percentage",
    unit: "%",
    allowedValues: [],
    aliases: ["percentual de divergencia", "tolerancia", "limite percentual", "divergencia maxima"],
    required: false,
    active: true
  }
];

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function normalizeText(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function unique(values) {
  return Array.from(new Set(values));
}

function publicItem(item) {
  return Object.freeze({
    code: item.code,
    name: item.name,
    description: item.description,
    category: item.category,
    valueType: item.valueType,
    unit: item.unit,
    allowedValues: Object.freeze(item.allowedValues.slice()),
    aliases: Object.freeze(item.aliases.slice()),
    required: Boolean(item.required),
    active: item.active !== false
  });
}

function validateMunicipalCatalog(catalog = MUNICIPAL_PROFILE_CATALOG) {
  const errors = [];
  const codes = new Set();

  catalog.forEach((item, index) => {
    const path = `catalog[${index}]`;
    const code = clean(item && item.code);
    const name = clean(item && item.name);
    const category = clean(item && item.category);
    const valueType = clean(item && item.valueType);
    const unit = clean(item && item.unit);
    const aliases = Array.isArray(item && item.aliases) ? item.aliases.map(clean).filter(Boolean) : [];
    const normalizedAliases = aliases.map(normalizeText);
    const allowedValues = Array.isArray(item && item.allowedValues) ? item.allowedValues.map(clean).filter(Boolean) : [];

    if (!/^MUN_[A-Z]{3}_[0-9]{3}$/.test(code)) errors.push(`${path}.code_invalid`);
    if (codes.has(code)) errors.push(`${path}.code_duplicate`);
    if (code) codes.add(code);
    if (!name) errors.push(`${path}.name_required`);
    if (!CATEGORIES.has(category)) errors.push(`${path}.category_invalid`);
    if (!VALUE_TYPES.has(valueType)) errors.push(`${path}.valueType_invalid`);
    if (unique(normalizedAliases).length !== normalizedAliases.length) errors.push(`${path}.aliases_duplicate`);
    if (valueType === "enum" && allowedValues.length < 2) errors.push(`${path}.allowedValues_required_for_enum`);
    if (valueType !== "enum" && allowedValues.length) errors.push(`${path}.allowedValues_only_for_enum`);
    if (VALUE_TYPES.has(valueType) && !UNIT_BY_VALUE_TYPE[valueType].has(unit)) errors.push(`${path}.unit_incompatible`);
  });

  return { ok: errors.length === 0, errors };
}

function getMunicipalCatalog() {
  return Object.freeze(MUNICIPAL_PROFILE_CATALOG.map(publicItem));
}

function findMunicipalCatalogItemByCode(code) {
  const normalized = clean(code).toUpperCase();
  const item = MUNICIPAL_PROFILE_CATALOG.find((candidate) => candidate.code === normalized);
  return item ? publicItem(item) : null;
}

function findMunicipalCatalogCandidates(text) {
  const query = normalizeText(text);
  if (!query) return [];
  return MUNICIPAL_PROFILE_CATALOG
    .map((item) => {
      const aliases = item.aliases.map(normalizeText);
      const fields = [item.code, item.name, item.description, item.category].map(normalizeText).concat(aliases);
      const matchedAliases = item.aliases.filter((alias) => query.includes(normalizeText(alias)));
      const score = fields.reduce((sum, field) => sum + (field && query.includes(field) ? 2 : 0), 0) + matchedAliases.length * 3;
      return { item, score, matchedAliases };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.code.localeCompare(b.item.code))
    .map((entry) => Object.freeze(Object.assign({}, publicItem(entry.item), {
      matchedAliases: Object.freeze(entry.matchedAliases.slice())
    })));
}

function normalizeMunicipalCatalogValue(itemOrCode, value) {
  const item = typeof itemOrCode === "string" ? findMunicipalCatalogItemByCode(itemOrCode) : itemOrCode;
  if (!item) return { ok: false, error: "catalog_item_not_found" };
  const rawValue = clean(value);
  if (item.valueType === "boolean") {
    const normalized = normalizeText(rawValue);
    if (BOOLEAN_TRUE.has(normalized)) return { ok: true, rawValue, normalizedValue: true, valueType: "boolean" };
    if (BOOLEAN_FALSE.has(normalized)) return { ok: true, rawValue, normalizedValue: false, valueType: "boolean" };
    return { ok: false, rawValue, error: "boolean_value_invalid" };
  }
  if (item.valueType === "enum") {
    const normalized = normalizeText(rawValue);
    const match = item.allowedValues.find((allowed) => normalizeText(allowed) === normalized);
    if (!match) return { ok: false, rawValue, error: "enum_value_invalid" };
    return { ok: true, rawValue, normalizedValue: match, valueType: "enum" };
  }
  return { ok: true, rawValue, normalizedValue: rawValue, valueType: item.valueType };
}

export {
  CATEGORIES as MUNICIPAL_CATALOG_CATEGORIES,
  MUNICIPAL_PROFILE_CATALOG,
  VALUE_TYPES as MUNICIPAL_CATALOG_VALUE_TYPES,
  findMunicipalCatalogCandidates,
  findMunicipalCatalogItemByCode,
  getMunicipalCatalog,
  normalizeMunicipalCatalogValue,
  validateMunicipalCatalog
};
