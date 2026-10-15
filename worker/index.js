/* BYYND — backend (lot 2). Cloudflare Worker + D1. Zéro dépendance. */
import { handleStrava, hourly, stravaApi } from "./strava.js";
const VERSION = "2.1.0";
const ALLOWED_ORIGINS = ["https://emilyguindi.github.io"];

function cors(req) {
  const o = req.headers.get("Origin") || "";
  const h = { "Access-Control-Allow-Methods": "GET,PUT,POST,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Authorization,Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin" };
  if (ALLOWED_ORIGINS.includes(o)) h["Access-Control-Allow-Origin"] = o;
  return h;
}
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra } });

function authed(req, env) {
  const a = req.headers.get("Authorization") || "";
  const key = (a.startsWith("Bearer ") ? a.slice(7) : "").trim();
  const ref = String(env.APP_KEY || "").trim();
  if (!ref || !key || key.length !== ref.length) return false;
  let diff = 0; for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ ref.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const c = cors(req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: c });
    if (url.pathname.startsWith("/api/")) return api(req, env, url, c).catch(e => json({ error: "server", detail: String(e.message || e) }, 500, c));
    if (url.pathname.startsWith("/strava/")) return handleStrava(req, env, ctx, url).catch(e => new Response("error", { status: 500 }));
    return env.ASSETS.fetch(req);
  },
  async scheduled(event, env, ctx) {
    const d = new Date(event.scheduledTime);
    if (d.getUTCMinutes() < 5) ctx.waitUntil(hourly(env));
    /* Lot 3 : notifications push. */
  }
};

async function api(req, env, url, c) {
  const p = url.pathname;
  if (p === "/api/health") return json({ ok: true, version: VERSION, time: new Date().toISOString(), db: !!env.DB, authConfigured: !!env.APP_KEY }, 200, c);
  if (!authed(req, env)) return json({ error: "unauthorized" }, 401, c);
  if (!env.DB) return json({ error: "no_db" }, 500, c);

  if (p === "/api/state") {
    if (req.method === "GET") {
      const row = await env.DB.prepare("SELECT json, updated_at FROM state WHERE id = ?").bind("main").first();
      return row ? json({ json: row.json, updatedAt: row.updated_at }, 200, c) : json({ json: null, updatedAt: 0 }, 200, c);
    }
    if (req.method === "PUT") {
      const body = await req.json();
      if (!body || typeof body.json !== "string" || typeof body.updatedAt !== "number") return json({ error: "bad_request" }, 400, c);
      if (body.json.length > 4_000_000) return json({ error: "too_large" }, 413, c);
      const cur = await env.DB.prepare("SELECT updated_at FROM state WHERE id = ?").bind("main").first();
      // Concurrence optimiste : on n'écrase jamais une version qu'on n'a pas vue. Les anciens clients (sans base) ne peuvent plus écrire.
      if (cur && (typeof body.base !== "number" || cur.updated_at !== body.base)) {
        const row = await env.DB.prepare("SELECT json, updated_at FROM state WHERE id = ?").bind("main").first();
        return json({ conflict: true, json: row.json, updatedAt: row.updated_at }, 409, c);
      }
      await env.DB.prepare("INSERT INTO state (id, json, updated_at) VALUES ('main', ?1, ?2) ON CONFLICT(id) DO UPDATE SET json = ?1, updated_at = ?2").bind(body.json, body.updatedAt).run();
      return json({ ok: true, updatedAt: body.updatedAt }, 200, c);
    }
  }
  if (p.startsWith("/api/strava/") || p === "/api/activities") { const r = await stravaApi(req, env, null, url, json, c); if (r) return r; }
  if (p === "/api/push/subscribe" && req.method === "POST") {
    const sub = await req.json();
    if (!sub || !sub.endpoint) return json({ error: "bad_request" }, 400, c);
    await env.DB.prepare("INSERT INTO push_subs (endpoint, json, created_at) VALUES (?1, ?2, ?3) ON CONFLICT(endpoint) DO UPDATE SET json = ?2").bind(sub.endpoint, JSON.stringify(sub), Date.now()).run();
    return json({ ok: true }, 200, c);
  }
  if (p === "/api/push/subscribe" && req.method === "DELETE") {
    const sub = await req.json();
    await env.DB.prepare("DELETE FROM push_subs WHERE endpoint = ?").bind(sub.endpoint || "").run();
    return json({ ok: true }, 200, c);
  }
  if (p === "/api/backup" && req.method === "GET") {
    const row = await env.DB.prepare("SELECT json, updated_at FROM state WHERE id = ?").bind("main").first();
    return new Response(row ? row.json : "{}", { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="byynd-backup-${new Date().toISOString().slice(0, 10)}.json"`, ...c } });
  }
  return json({ error: "not_found" }, 404, c);
}
