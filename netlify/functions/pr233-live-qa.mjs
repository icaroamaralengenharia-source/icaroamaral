// Temporary QA transport for this PR only. Backend bearer/tenant authorization stays authoritative.
const PREVIEW_ORIGIN = "https://deploy-preview-233--icaroamaral.netlify.app";
const PREFIX = "/__pr233_live_qa";
const BACKEND_ORIGIN = "https://obrareport-backend.onrender.com";
const REQUEST_HEADERS = ["authorization", "accept", "content-type", "x-user-id", "x-institution-id", "x-company-id"];

function reply(status, error) {
  return Response.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store", "Netlify-CDN-Cache-Control": "no-store" } });
}

function allowedRoute(method, path) {
  if (method === "GET") return ["/api/health", "/api/elo/me", "/api/stock-full/works", "/api/obrareport/rdos", "/api/elo/memories", "/api/elo/conversations"].includes(path) || /^\/api\/elo\/conversations\/[a-zA-Z0-9_-]{1,200}$/.test(path);
  if (method === "POST") return ["/api/elo/identity/merge", "/api/elo/conversations"].includes(path) || /^\/api\/elo\/conversations\/[a-zA-Z0-9_-]{1,200}\/messages$/.test(path);
  return false;
}

export default async function (request, context) {
  const url = new URL(request.url);
  // Never activate on production, another preview, a deploy permalink or another Origin.
  if (context?.deploy?.context !== "deploy-preview" || url.origin !== PREVIEW_ORIGIN || request.headers.get("origin") && request.headers.get("origin") !== PREVIEW_ORIGIN) return reply(403, "pr233_preview_origin_required");
  if (!url.pathname.startsWith(PREFIX + "/")) return reply(404, "pr233_preview_route_not_found");
  const path = url.pathname.slice(PREFIX.length);
  if (!allowedRoute(request.method, path)) return reply(405, "pr233_qa_route_or_method_blocked");
  const authorization = request.headers.get("authorization") || "";
  if (path !== "/api/health" && !/^Bearer \S+$/i.test(authorization)) return reply(401, "authentication_required");
  const headers = new Headers();
  for (const name of REQUEST_HEADERS) if (request.headers.has(name)) headers.set(name, request.headers.get(name));
  try {
    const body = request.method === "POST" ? await request.text() : undefined;
    if (body && new TextEncoder().encode(body).length > 65536) return reply(413, "pr233_qa_body_too_large");
    const upstream = await fetch(BACKEND_ORIGIN + path + url.search, { method: request.method, headers, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000) });
    const outputHeaders = new Headers({ "Cache-Control": "no-store", "Netlify-CDN-Cache-Control": "no-store", "Vary": "Authorization, Origin" });
    outputHeaders.set("Content-Type", upstream.headers.get("content-type") || "application/json");
    return new Response(upstream.body, { status: upstream.status, headers: outputHeaders });
  } catch (_) {
    // No request, token, identity, backend body or infrastructure details in logs/errors.
    return reply(502, "pr233_qa_upstream_unavailable");
  }
}

export const config = { path: "/__pr233_live_qa/*" };
