/* BYYND — intégration Strava (lot 4). Données brutes normalisées dans strava_activities ; aucune décision de coaching ici. */
const API = 'https://www.strava.com/api/v3';
const OAUTH = 'https://www.strava.com/oauth';
const SCOPES = 'read,activity:read_all';

const enc = new TextEncoder();
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
}
export async function connectUrl(env, origin) {
  const ts = Date.now().toString();
  const state = `${ts}.${await hmac(env.APP_KEY, ts)}`;
  const p = new URLSearchParams({ client_id: env.STRAVA_CLIENT_ID, response_type: 'code', redirect_uri: `${origin}/strava/callback`, approval_prompt: 'auto', scope: SCOPES, state });
  return `${OAUTH}/mobile/authorize?${p}`;
}
async function validState(env, state) {
  const [ts, sig] = String(state || '').split('.');
  if (!ts || !sig || Date.now() - +ts > 15 * 60 * 1000) return false;
  return (await hmac(env.APP_KEY, ts)) === sig;
}

async function getConn(env) {
  const r = await env.DB.prepare("SELECT json FROM integrations WHERE name='strava'").first();
  return r ? JSON.parse(r.json) : null;
}
async function saveConn(env, c) {
  await env.DB.prepare("INSERT INTO integrations (name,json,updated_at) VALUES ('strava',?1,?2) ON CONFLICT(name) DO UPDATE SET json=?1, updated_at=?2").bind(JSON.stringify(c), Date.now()).run();
}
async function token(env) {
  const c = await getConn(env); if (!c) return null;
  if (c.expiresAt * 1000 > Date.now() + 60_000) return c.access;
  const r = await fetch(`${OAUTH}/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: c.refresh }) });
  if (!r.ok) { c.error = `refresh ${r.status}`; await saveConn(env, c); return null; }
  const t = await r.json();
  Object.assign(c, { access: t.access_token, refresh: t.refresh_token, expiresAt: t.expires_at, error: null });
  await saveConn(env, c); return c.access;
}
async function sget(env, path) {
  const t = await token(env); if (!t) throw new Error('no_token');
  const r = await fetch(API + path, { headers: { Authorization: `Bearer ${t}` } });
  if (r.status === 429) throw new Error('rate_limited');
  if (!r.ok) throw new Error(`strava ${r.status}`);
  return r.json();
}

/** Ne garde que ce dont BYYND a besoin. */
function normalize(a) {
  return {
    stravaId: String(a.id), name: a.name, sportType: a.sport_type || a.type, date: String(a.start_date_local || '').slice(0, 10),
    startLocal: a.start_date_local, distanceKm: a.distance ? Math.round(a.distance / 10) / 100 : null,
    movingMin: a.moving_time ? Math.round(a.moving_time / 6) / 10 : null, elapsedMin: a.elapsed_time ? Math.round(a.elapsed_time / 6) / 10 : null,
    elevM: a.total_elevation_gain != null ? Math.round(a.total_elevation_gain) : null, avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    maxHr: a.max_heartrate ? Math.round(a.max_heartrate) : null, perceived: a.perceived_exertion ?? null, trainer: !!a.trainer,
    laps: Array.isArray(a.laps) ? a.laps.slice(0, 40).map(l => ({ km: Math.round(l.distance / 10) / 100, s: l.moving_time, hr: l.average_heartrate ? Math.round(l.average_heartrate) : null, elev: l.total_elevation_gain ?? null })) : undefined,
  };
}
async function upsert(env, n) {
  await env.DB.prepare('INSERT INTO strava_activities (id,updated_at,deleted,json) VALUES (?1,?2,0,?3) ON CONFLICT(id) DO UPDATE SET updated_at=?2, deleted=0, json=?3').bind(n.stravaId, Date.now(), JSON.stringify(n)).run();
}
async function importOne(env, id) {
  const a = await sget(env, `/activities/${id}?include_all_efforts=false`);
  await upsert(env, normalize(a));
}
/** Liste les activités depuis `afterSec` ; les détails (FC, tours) seulement pour les nouvelles ou modifiées. */
export async function backfill(env, afterSec, maxDetail = 25) {
  let page = 1, detail = 0, seen = 0;
  while (page <= 5) {
    const list = await sget(env, `/athlete/activities?after=${afterSec}&per_page=100&page=${page}`);
    if (!list.length) break;
    for (const a of list) {
      seen++;
      const row = await env.DB.prepare('SELECT json FROM strava_activities WHERE id=?').bind(String(a.id)).first();
      const old = row ? JSON.parse(row.json) : null;
      const changed = !old || old.name !== a.name || old.sportType !== (a.sport_type || a.type) || Math.abs((old.distanceKm || 0) * 1000 - (a.distance || 0)) > 5;
      if (changed && detail < maxDetail) { await importOne(env, a.id); detail++; }
      else if (changed) await upsert(env, normalize(a));
    }
    if (list.length < 100) break; page++;
  }
  const c = await getConn(env); if (c) { c.lastSync = Date.now(); await saveConn(env, c); }
  return { seen, detail };
}

export async function handleStrava(req, env, ctx, url) {
  const p = url.pathname;
  if (p === '/strava/webhook' && req.method === 'GET') {
    if (url.searchParams.get('hub.verify_token') !== env.STRAVA_VERIFY_TOKEN) return new Response('forbidden', { status: 403 });
    return Response.json({ 'hub.challenge': url.searchParams.get('hub.challenge') });
  }
  if (p === '/strava/webhook' && req.method === 'POST') {
    const ev = await req.json().catch(() => null);
    if (ev && ev.object_type === 'activity') {
      ctx.waitUntil((async () => {
        try {
          if (ev.aspect_type === 'delete') await env.DB.prepare('UPDATE strava_activities SET deleted=1, updated_at=?2 WHERE id=?1').bind(String(ev.object_id), Date.now()).run();
          else await importOne(env, ev.object_id);
        } catch (e) { /* rattrapé par le cron horaire */ }
      })());
    } else if (ev && ev.object_type === 'athlete' && ev.updates && ev.updates.authorized === 'false') {
      ctx.waitUntil(env.DB.prepare("DELETE FROM integrations WHERE name='strava'").run());
    }
    return new Response('ok');
  }
  if (p === '/strava/callback') {
    const ok = await validState(env, url.searchParams.get('state'));
    const code = url.searchParams.get('code');
    if (!ok || !code) return done(false, url.searchParams.get('error') || 'state');
    const r = await fetch(`${OAUTH}/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, code, grant_type: 'authorization_code' }) });
    if (!r.ok) return done(false, `token ${r.status}`);
    const t = await r.json();
    await saveConn(env, { athleteId: t.athlete?.id, athleteName: [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(' '), access: t.access_token, refresh: t.refresh_token, expiresAt: t.expires_at, scope: url.searchParams.get('scope'), connectedAt: Date.now(), lastSync: null });
    ctx.waitUntil(backfill(env, Math.floor(Date.now() / 1000) - 90 * 86400, 40).catch(() => {}));
    return done(true);
  }
  return new Response('not found', { status: 404 });
}
function done(ok, err = '') {
  const target = `byynd://strava?ok=${ok ? 1 : 0}${err ? `&err=${encodeURIComponent(err)}` : ''}`;
  return new Response(`<!doctype html><meta name=viewport content="width=device-width"><meta http-equiv="refresh" content="0;url=${target}"><body style="font-family:system-ui;padding:24px"><p>${ok ? 'Strava est connecté à BYYND.' : 'La connexion Strava a échoué.'}</p><p><a href="${target}">Retourner dans BYYND</a></p>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function stravaApi(req, env, ctx, url, json, c) {
  const p = url.pathname;
  const configured = !!(env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET);
  if (p === '/api/strava/status') {
    const conn = await getConn(env);
    return json({ configured, connected: !!conn && !conn.error, athlete: conn?.athleteName || null, lastSync: conn?.lastSync || null, error: conn?.error || null }, 200, c);
  }
  if (!configured) return json({ error: 'strava_not_configured' }, 503, c);
  if (p === '/api/strava/connect-url') return json({ url: await connectUrl(env, url.origin) }, 200, c);
  if (p === '/api/strava/sync' && req.method === 'POST') {
    const days = Math.min(365, Math.max(1, +(url.searchParams.get('days') || 14)));
    try { const r = await backfill(env, Math.floor(Date.now() / 1000) - days * 86400, 15); return json({ ok: true, ...r }, 200, c); }
    catch (e) { return json({ error: String(e.message) }, e.message === 'rate_limited' ? 429 : 502, c); }
  }
  if (p === '/api/strava/disconnect' && req.method === 'POST') {
    const conn = await getConn(env);
    if (conn) { const t = await token(env).catch(() => null); if (t) await fetch(`${OAUTH}/deauthorize`, { method: 'POST', headers: { Authorization: `Bearer ${t}` } }).catch(() => {}); }
    await env.DB.prepare("DELETE FROM integrations WHERE name='strava'").run();
    return json({ ok: true }, 200, c);
  }
  if (p === '/api/activities') {
    const since = +(url.searchParams.get('since') || 0);
    const rows = await env.DB.prepare('SELECT json, deleted, updated_at FROM strava_activities WHERE updated_at > ? ORDER BY updated_at LIMIT 500').bind(since).all();
    const items = rows.results.map(r => ({ ...JSON.parse(r.json), deleted: !!r.deleted, updatedAt: r.updated_at }));
    return json({ items, until: items.length ? items[items.length - 1].updatedAt : since }, 200, c);
  }
  return null;
}

/** Cron horaire : rattrape un webhook manqué. */
export async function hourly(env) {
  if (!env.STRAVA_CLIENT_ID) return;
  const c = await getConn(env); if (!c || c.error) return;
  await backfill(env, Math.floor(Date.now() / 1000) - 3 * 86400, 10).catch(() => {});
}
