/* BYYND — backend (lot 2). Cloudflare Worker + D1. Zéro dépendance. */
import { handleStrava, hourly, stravaApi } from "./strava.js";
import { authenticate, backup, getMeta, readState, safeEqual, signInWithGoogle, writeState } from "./auth.js";
const VERSION = "5.0.0";
const ALLOWED_ORIGINS = ["https://emilyguindi.github.io"];

function cors(req) {
  const o = req.headers.get("Origin") || "";
  const h = { "Access-Control-Allow-Methods": "GET,PUT,POST,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Authorization,Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin" };
  if (ALLOWED_ORIGINS.includes(o)) h["Access-Control-Allow-Origin"] = o;
  return h;
}
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra } });

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
  if (p === "/api/health") return json({ ok: true, version: VERSION, time: new Date().toISOString(), db: !!env.DB, authConfigured: !!env.APP_KEY, google: { clientId: String(env.GOOGLE_WEB_CLIENT_ID || "").split(",")[0].trim() || null } }, 200, c);
  if (!env.DB) return json({ error: "no_db" }, 500, c);

  // Connexion Google : seule route accessible sans session. La clé historique, si fournie, prouve la propriété des données existantes.
  if (p === "/api/auth/google" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const legacyOk = !!env.APP_KEY && safeEqual(String(req.headers.get("X-Legacy-Key") || "").trim(), String(env.APP_KEY).trim());
    const r = await signInWithGoogle(env, body.idToken, body.device, legacyOk);
    return json(r.body, r.status, c);
  }

  const who = await authenticate(req, env);
  if (!who) return json({ error: "unauthorized" }, 401, c);
  const owner = await getMeta(env, "owner_user_id");
  const isOwner = who.legacy || (!!owner && who.userId === owner);

  if (p === "/api/auth/me") {
    if (!who.userId) return json({ user: null, legacy: true }, 200, c);
    const u = await env.DB.prepare("SELECT email, name, created_at FROM users WHERE id=?").bind(who.userId).first();
    return json({ user: u ? { email: u.email, name: u.name, since: u.created_at } : null, legacy: who.legacy, owner: isOwner, sessionId: who.sessionId || null }, 200, c);
  }
  if (p === "/api/auth/sessions" && req.method === "GET") {
    if (!who.userId) return json({ sessions: [] }, 200, c);
    const rows = await env.DB.prepare("SELECT id, device, created_at, last_seen, expires_at FROM sessions WHERE user_id=? AND revoked_at IS NULL AND expires_at > ? ORDER BY last_seen DESC").bind(who.userId, Date.now()).all();
    return json({ sessions: rows.results.map(r => ({ ...r, current: r.id === who.sessionId })) }, 200, c);
  }
  if (p.startsWith("/api/auth/sessions/") && req.method === "DELETE") {
    // Révocation : uniquement parmi les sessions de l'utilisateur authentifié (un identifiant d'une autre personne ne fait rien).
    const id = p.split("/").pop();
    const r = await env.DB.prepare("UPDATE sessions SET revoked_at=?3 WHERE id=?1 AND user_id=?2 AND revoked_at IS NULL").bind(id, who.userId || "", Date.now()).run();
    return json({ ok: !!(r.meta && r.meta.changes) }, r.meta && r.meta.changes ? 200 : 404, c);
  }
  if (p === "/api/auth/logout" && req.method === "POST") {
    if (who.sessionId) await env.DB.prepare("UPDATE sessions SET revoked_at=?2 WHERE id=?1").bind(who.sessionId, Date.now()).run();
    return json({ ok: true }, 200, c);
  }
  if (p === "/api/auth/logout-all" && req.method === "POST") {
    if (who.userId) await env.DB.prepare("UPDATE sessions SET revoked_at=?2 WHERE user_id=?1 AND revoked_at IS NULL").bind(who.userId, Date.now()).run();
    return json({ ok: true }, 200, c);
  }

  if (p === "/api/state") {
    if (req.method === "GET") { const row = await readState(env, who); return json(row ? { json: row.json, updatedAt: row.updated_at } : { json: null, updatedAt: 0 }, 200, c); }
    if (req.method === "PUT") {
      const body = await req.json();
      if (!body || typeof body.json !== "string" || typeof body.updatedAt !== "number") return json({ error: "bad_request" }, 400, c);
      if (body.json.length > 4_000_000) return json({ error: "too_large" }, 413, c);
      const r = await writeState(env, who, { json: body.json, updatedAt: body.updatedAt, base: typeof body.base === "number" ? body.base : -1 });
      if (r.conflict) return json({ conflict: true, json: r.conflict.json, updatedAt: r.conflict.updated_at }, 409, c);
      return json({ ok: true, updatedAt: body.updatedAt }, 200, c);
    }
  }
  if (p === "/api/backups" && req.method === "GET") {
    if (!who.userId) return json({ backups: [] }, 200, c);
    const rows = await env.DB.prepare("SELECT id, updated_at, created_at, reason, length(json) AS size FROM state_backups WHERE user_id=? ORDER BY id DESC").bind(who.userId).all();
    return json({ backups: rows.results }, 200, c);
  }
  if (p.startsWith("/api/backups/") && p.endsWith("/restore") && req.method === "POST") {
    if (!who.userId) return json({ error: "account_required" }, 403, c);
    const id = +p.split("/")[3];
    const b = await env.DB.prepare("SELECT json, updated_at FROM state_backups WHERE id=? AND user_id=?").bind(id, who.userId).first();
    if (!b) return json({ error: "not_found" }, 404, c);
    const cur = await readState(env, who); await backup(env, who.userId, "avant restauration", cur);
    const now = Date.now();
    await env.DB.prepare("INSERT INTO user_state (user_id, json, updated_at) VALUES (?1,?2,?3) ON CONFLICT(user_id) DO UPDATE SET json=?2, updated_at=?3").bind(who.userId, b.json, now).run();
    return json({ ok: true, json: b.json, updatedAt: now }, 200, c);
  }
  if (p === "/api/account" && req.method === "DELETE") {
    // Suppression des données du compte : confirmation explicite exigée.
    if (!who.userId || url.searchParams.get("confirm") !== "SUPPRIMER") return json({ error: "confirmation_required" }, 400, c);
    for (const q of ["DELETE FROM user_state WHERE user_id=?", "DELETE FROM state_backups WHERE user_id=?", "DELETE FROM sessions WHERE user_id=?", "DELETE FROM users WHERE id=?"]) await env.DB.prepare(q).bind(who.userId).run();
    if (isOwner) await env.DB.prepare("DELETE FROM meta WHERE key='owner_user_id'").run();
    return json({ ok: true }, 200, c);
  }
  // Strava : connexion unique de l'instance, réservée à son propriétaire.
  if (p.startsWith("/api/strava/") || p === "/api/activities") {
    if (!isOwner) return json({ error: "forbidden" }, 403, c);
    const r = await stravaApi(req, env, null, url, json, c); if (r) return r;
  }
  if (p === "/api/backup" && req.method === "GET") {
    const row = await readState(env, who);
    return new Response(row ? row.json : "{}", { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="byynd-backup-${new Date().toISOString().slice(0, 10)}.json"`, ...c } });
  }
  return json({ error: "not_found" }, 404, c);
}
