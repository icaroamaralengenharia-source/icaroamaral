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

  const globalOptions = {};
  if (serviceRoleKey.startsWith("sb_secret_")) {
    globalOptions.fetch = async (input, init = {}) => {
      const url = String(input && input.url ? input.url : input);
      const headers = new Headers(init.headers);
      if (url.includes("/rest/v1/")) {
        headers.delete("Authorization");
      }
      return fetch(input, { ...init, headers });
    };
  }

  cachedClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: globalOptions
  });
  cachedSignature = signature;
  return cachedClient;
}
