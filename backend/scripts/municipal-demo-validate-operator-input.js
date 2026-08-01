import { UUID_RE, findBlockedProject, maskUuid, sanitize } from "./municipal-demo-lib.js";

const LIVE_PREFIX = "DEMO_MUNICIPAL_";
const REQUIRED_CONFIRMATION = "SIM";
const PROJECT_REF_RE = /^[a-z0-9]{20}$/;
const SECRET_TEXT_RE = /(password|senha|token|jwt|bearer|secret|service[_-]?role|anon[_-]?key|api[_-]?key|connection\s*string|database[_-]?url|postgres:\/\/)/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const CPF_RE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
const PHONE_RE = /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4}[-\s]?\d{4}/;
const LOCALHOST_RE = /\b(localhost|127\.0\.0\.1|0\.0\.0\.0)\b/i;

const USER_FIELDS = [
  "platformAdminUserId",
  "municipalAdminUserId",
  "gestorUserId",
  "leituraUserId"
];

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function pushError(errors, field, code) {
  errors.push({ field, code });
}

function parseHttpsUrl(value) {
  try {
    return new URL(clean(value));
  } catch (_) {
    return null;
  }
}

function validateOperatorInput(input = {}) {
  const errors = [];
  const environmentName = clean(input.environmentName);
  const plannedDomain = clean(input.plannedDomain);
  const projectRef = clean(input.projectRef).toLowerCase();
  const technicalOwner = clean(input.technicalOwner);
  const domain = parseHttpsUrl(plannedDomain);

  if (!environmentName.startsWith(LIVE_PREFIX)) pushError(errors, "environmentName", "environment_name_prefix_required");
  if (SECRET_TEXT_RE.test(environmentName) || /https?:\/\//i.test(environmentName)) pushError(errors, "environmentName", "environment_name_contains_sensitive_value");

  if (!domain || domain.protocol !== "https:") pushError(errors, "plannedDomain", "https_domain_required");
  if (LOCALHOST_RE.test(plannedDomain)) pushError(errors, "plannedDomain", "localhost_domain_forbidden");
  if (/postgres:\/\//i.test(plannedDomain)) pushError(errors, "plannedDomain", "database_url_forbidden");

  if (!PROJECT_REF_RE.test(projectRef)) pushError(errors, "projectRef", "project_ref_invalid_format");
  const blockedProject = findBlockedProject(projectRef) || findBlockedProject(plannedDomain);
  if (blockedProject) pushError(errors, "projectRef", `blocked_project_ref:${blockedProject}`);

  if (!technicalOwner) pushError(errors, "technicalOwner", "technical_owner_required");
  if (EMAIL_RE.test(technicalOwner)) pushError(errors, "technicalOwner", "technical_owner_email_forbidden");
  if (PHONE_RE.test(technicalOwner) || CPF_RE.test(technicalOwner)) pushError(errors, "technicalOwner", "technical_owner_personal_data_forbidden");
  if (SECRET_TEXT_RE.test(technicalOwner) || /https?:\/\//i.test(technicalOwner)) pushError(errors, "technicalOwner", "technical_owner_sensitive_value_forbidden");

  for (const field of ["isolationConfirmed", "backupConfirmed", "integrationsDisabledConfirmed"]) {
    if (clean(input[field]).toUpperCase() !== REQUIRED_CONFIRMATION) pushError(errors, field, "confirmation_SIM_required");
  }

  const seenUuids = new Set();
  for (const field of USER_FIELDS) {
    const value = clean(input[field]);
    if (!UUID_RE.test(value)) {
      pushError(errors, field, "uuid_invalid");
      continue;
    }
    const normalized = value.toLowerCase();
    if (seenUuids.has(normalized)) pushError(errors, field, "uuid_repeated");
    seenUuids.add(normalized);
  }

  for (const [field, value] of Object.entries(input)) {
    if (SECRET_TEXT_RE.test(clean(value)) && !["plannedDomain"].includes(field)) {
      pushError(errors, field, "sensitive_value_forbidden");
    }
  }

  if (errors.length) {
    const error = new Error(`operator_input_invalid:${errors.map((item) => `${item.field}:${item.code}`).join(",")}`);
    error.code = "operator_input_invalid";
    error.errors = errors;
    throw error;
  }

  return sanitize({
    ok: true,
    environmentName,
    plannedDomain,
    projectRef,
    technicalOwner,
    confirmations: {
      isolation: true,
      backup: true,
      integrationsDisabled: true
    },
    users: Object.fromEntries(USER_FIELDS.map((field) => [field, maskUuid(clean(input[field]))]))
  });
}

function safeOperatorInput(input = {}) {
  const validated = validateOperatorInput(input);
  return {
    environmentName: validated.environmentName,
    plannedDomain: validated.plannedDomain,
    projectRef: validated.projectRef,
    technicalOwner: validated.technicalOwner,
    users: validated.users
  };
}

export {
  EMAIL_RE,
  LOCALHOST_RE,
  PROJECT_REF_RE,
  REQUIRED_CONFIRMATION,
  SECRET_TEXT_RE,
  USER_FIELDS,
  validateOperatorInput,
  safeOperatorInput
};
