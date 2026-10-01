import "dotenv/config";
import { createApartmentHandoverInvite, DEFAULT_INVITE_MAX_REDEMPTIONS, DEFAULT_INVITE_TTL_HOURS } from "../src/apartment-handover-invite-service.js";
import { getSupabaseClient } from "../src/supabase.js";

function arg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : "";
}

const institutionId = arg("institution-id") || process.env.APARTMENT_HANDOVER_INVITE_INSTITUTION_ID || "";
const ttlHours = Number(arg("ttl-hours") || process.env.APARTMENT_HANDOVER_INVITE_TTL_HOURS || DEFAULT_INVITE_TTL_HOURS);
const maxRedemptions = Number(arg("max-redemptions") || process.env.APARTMENT_HANDOVER_INVITE_MAX_REDEMPTIONS || DEFAULT_INVITE_MAX_REDEMPTIONS);
const createdBy = arg("created-by") || process.env.APARTMENT_HANDOVER_INVITE_CREATED_BY || "";
const baseUrl = (arg("base-url") || process.env.APARTMENT_HANDOVER_TRIAL_URL || "https://www.icaroamaral.com.br/vistoria-entrega-apartamento-trial/").replace(/\?+$/g, "");

if (!institutionId) {
  console.error("Uso: node scripts/create-apartment-handover-invite.js --institution-id=UUID [--ttl-hours=72] [--max-redemptions=3]");
  process.exit(1);
}

const supabase = getSupabaseClient(process.env);
if (!supabase) {
  console.error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios no ambiente local seguro.");
  process.exit(1);
}

const result = await createApartmentHandoverInvite(supabase, {
  institutionId,
  ttlHours,
  maxRedemptions,
  createdBy
});

const url = new URL(baseUrl);
url.searchParams.set("invite", result.token);

console.log(JSON.stringify({
  ok: true,
  invite: result.invite,
  raw_token_visible_once: result.token,
  url: url.toString()
}, null, 2));
