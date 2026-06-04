import { createClient } from "@supabase/supabase-js";

let cachedClient = null;
let cachedSignature = "";

export function getSupabaseClient(env = process.env) {
  const supabaseUrl = String(env.SUPABASE_URL || "").trim();
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  const signature = supabaseUrl + ":" + serviceRoleKey.length;
  if (cachedClient && cachedSignature === signature) {
    return cachedClient;
  }

  cachedClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  cachedSignature = signature;
  return cachedClient;
}
