/* BYYND — comptes, sessions et cloisonnement des données. Zéro dépendance : WebCrypto du Worker.
   - Connexion Google : le téléphone obtient un ID token Google (scopes openid email profile, rien d'autre) ;
     le serveur vérifie signature RS256 (clés publiques Google), émetteur, audience, expiration et e-mail vérifié.
   - Session BYYND : jeton aléatoire de 256 bits remis une seule fois au téléphone ; seul son SHA-256 est stocké.
     Expiration glissante (90 jours), révocation par appareil ou globale.
   - Chaque lecture/écriture est résolue sur l'utilisateur de la session : aucun identifiant d'utilisateur n'est lu dans la requête.
   - Clé historique (APP_KEY) : acceptée pour la transition, rattachée au compte propriétaire une fois celui-ci créé. */

const enc = new TextEncoder(), dec = new TextDecoder();
export const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const fromB64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), ch => ch.charCodeAt(0));
export const sha256 = async s => b64url(await crypto.subtle.digest('SHA-256', enc.encode(s)));
export const randomToken = (bytes = 32) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));
export function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || !b || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export const SESSION_DAYS = 90;
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
let jwksCache = null;
/** Clés publiques Google, en cache une heure (rechargées si un identifiant de clé est inconnu). */
export async function googleKeys(force = false, fetcher = fetch) {
  if (!force && jwksCache && Date.now() - jwksCache.at < 3600_000) return jwksCache.keys;
  const r = await fetcher('https://www.googleapis.com/oauth2/v3/certs');
  if (!r.ok) throw new Error('jwks');
  const d = await r.json(); jwksCache = { keys: d.keys || [], at: Date.now() }; return jwksCache.keys;
}

/** Vérifie un ID token Google. `audiences` : identifiants client OAuth autorisés (client « Web » utilisé par l'app). */
export async function verifyGoogleIdToken(idToken, audiences, { now = Date.now(), keys = googleKeys } = {}) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new Error('token_format');
  let header, payload;
  try { header = JSON.parse(dec.decode(fromB64url(parts[0]))); payload = JSON.parse(dec.decode(fromB64url(parts[1]))); } catch { throw new Error('token_format'); }
  if (header.alg !== 'RS256' || !header.kid) throw new Error('token_alg');
  let list = await keys(false); let jwk = list.find(k => k.kid === header.kid);
  if (!jwk) { list = await keys(true); jwk = list.find(k => k.kid === header.kid); }
  if (!jwk) throw new Error('token_key');
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromB64url(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new Error('token_signature');
  if (!GOOGLE_ISSUERS.includes(payload.iss)) throw new Error('token_issuer');
  if (!audiences.length || !audiences.includes(payload.aud)) throw new Error('token_audience');
  if (!payload.exp || payload.exp * 1000 < now - 60_000) throw new Error('token_expired');
  if (payload.iat && payload.iat * 1000 > now + 300_000) throw new Error('token_future');
  if (!payload.sub || !payload.email || payload.email_verified !== true && payload.email_verified !== 'true') throw new Error('token_email');
  return { sub: String(payload.sub), email: String(payload.email).toLowerCase(), name: payload.name ? String(payload.name).slice(0, 80) : null };
}

/* ---------- Méta : propriétaire de l'instance ---------- */
export async function getMeta(env, k) { const r = await env.DB.prepare('SELECT value FROM meta WHERE key=?').bind(k).first(); return r ? r.value : null; }
export async function setMeta(env, k, v) { await env.DB.prepare('INSERT INTO meta (key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=?2').bind(k, v).run(); }

/** Qui peut créer un compte : la liste ALLOWED_EMAILS si elle est définie ; sinon, seulement le tout premier compte (instance personnelle). */
export async function mayRegister(env, email) {
  const allow = String(env.ALLOWED_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (allow.length) return allow.includes(email);
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
  return !n || n.n === 0;
}

/* ---------- Sessions ---------- */
export async function createSession(env, userId, device, now = Date.now()) {
  const token = randomToken(); const id = randomToken(12);
  await env.DB.prepare('INSERT INTO sessions (id,user_id,token_hash,device,created_at,last_seen,expires_at) VALUES (?1,?2,?3,?4,?5,?5,?6)')
    .bind(id, userId, await sha256(token), String(device || 'Appareil').slice(0, 60), now, now + SESSION_DAYS * 86400_000).run();
  return { id, token };
}

/** Identifie l'appelant. Renvoie { userId, sessionId?, legacy } ou null. */
export async function authenticate(req, env, now = Date.now()) {
  const a = req.headers.get('Authorization') || '';
  const tok = (a.startsWith('Bearer ') ? a.slice(7) : '').trim();
  if (!tok) return null;
  if (env.APP_KEY && safeEqual(tok, String(env.APP_KEY).trim())) return { userId: await getMeta(env, 'owner_user_id'), legacy: true };
  const s = await env.DB.prepare('SELECT id, user_id, expires_at, last_seen, revoked_at FROM sessions WHERE token_hash=?').bind(await sha256(tok)).first();
  if (!s || s.revoked_at || s.expires_at < now) return null;
  // Expiration glissante : prolongée au plus une fois par jour.
  if (now - s.last_seen > 86400_000) await env.DB.prepare('UPDATE sessions SET last_seen=?2, expires_at=?3 WHERE id=?1').bind(s.id, now, now + SESSION_DAYS * 86400_000).run();
  return { userId: s.user_id, sessionId: s.id, legacy: false };
}

/* ---------- État et sauvegardes, toujours par utilisateur ---------- */
const BACKUP_EVERY = 24 * 3600_000, BACKUP_KEEP = 30;
export async function readState(env, who) {
  if (!who.userId) return env.DB.prepare("SELECT json, updated_at FROM state WHERE id='main'").first(); // avant tout compte : état historique
  return env.DB.prepare('SELECT json, updated_at FROM user_state WHERE user_id=?').bind(who.userId).first();
}
export async function backup(env, userId, reason, row, now = Date.now()) {
  if (!row) return;
  await env.DB.prepare('INSERT INTO state_backups (user_id,json,updated_at,created_at,reason) VALUES (?1,?2,?3,?4,?5)').bind(userId, row.json, row.updated_at, now, reason).run();
  await env.DB.prepare('DELETE FROM state_backups WHERE user_id=?1 AND id NOT IN (SELECT id FROM state_backups WHERE user_id=?1 ORDER BY id DESC LIMIT ?2)').bind(userId, BACKUP_KEEP).run();
}
/** Écrit l'état d'un utilisateur. Concurrence optimiste : on n'écrase jamais une version qu'on n'a pas vue (409 + version serveur). */
export async function writeState(env, who, body, now = Date.now()) {
  if (!who.userId) {
    const cur = await env.DB.prepare("SELECT updated_at FROM state WHERE id='main'").first();
    if (cur && cur.updated_at !== body.base) return { conflict: await readState(env, who) };
    await env.DB.prepare("INSERT INTO state (id, json, updated_at) VALUES ('main', ?1, ?2) ON CONFLICT(id) DO UPDATE SET json = ?1, updated_at = ?2").bind(body.json, body.updatedAt).run();
    return { ok: true };
  }
  const cur = await readState(env, who);
  if (cur && cur.updated_at !== body.base) return { conflict: cur };
  if (cur) { const last = await env.DB.prepare('SELECT created_at FROM state_backups WHERE user_id=? ORDER BY id DESC LIMIT 1').bind(who.userId).first(); if (!last || now - last.created_at > BACKUP_EVERY) await backup(env, who.userId, 'quotidienne', cur, now); }
  await env.DB.prepare('INSERT INTO user_state (user_id, json, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(user_id) DO UPDATE SET json = ?2, updated_at = ?3').bind(who.userId, body.json, body.updatedAt).run();
  return { ok: true };
}

/** Connexion Google. Au premier compte, l'état historique (clé APP_KEY) lui est rattaché, après sauvegarde, sans rien écraser. */
export async function signInWithGoogle(env, idToken, device, legacyKeyOk, verify = verifyGoogleIdToken, now = Date.now()) {
  const auds = String(env.GOOGLE_WEB_CLIENT_ID || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!auds.length) return { status: 503, body: { error: 'google_not_configured' } };
  let g; try { g = await verify(idToken, auds, { now }); } catch (e) { return { status: 401, body: { error: 'google_token_invalid', reason: String(e.message) } }; }
  let user = await env.DB.prepare('SELECT id, email FROM users WHERE google_sub=?').bind(g.sub).first();
  if (!user) {
    if (!(await mayRegister(env, g.email))) return { status: 403, body: { error: 'account_not_allowed' } };
    user = { id: randomToken(12), email: g.email };
    await env.DB.prepare('INSERT INTO users (id, google_sub, email, name, created_at) VALUES (?1,?2,?3,?4,?5)').bind(user.id, g.sub, g.email, g.name, now).run();
  }
  // Rattachement des données historiques : seulement pour qui prouve posséder la clé, et une seule fois.
  let migrated = false; const owner = await getMeta(env, 'owner_user_id');
  // Pas d'état historique du tout : le premier compte devient propriétaire de l'instance.
  const legacyExists = !!(await env.DB.prepare("SELECT 1 AS x FROM state WHERE id='main'").first());
  if (!owner && !legacyKeyOk && !legacyExists) await setMeta(env, 'owner_user_id', user.id);
  if (!owner && legacyKeyOk) {
    await setMeta(env, 'owner_user_id', user.id);
    const legacy = await env.DB.prepare("SELECT json, updated_at FROM state WHERE id='main'").first();
    const mine = await env.DB.prepare('SELECT json, updated_at FROM user_state WHERE user_id=?').bind(user.id).first();
    if (legacy) {
      await backup(env, user.id, 'avant rattachement au compte', legacy, now);
      if (!mine) await env.DB.prepare('INSERT INTO user_state (user_id, json, updated_at) VALUES (?1,?2,?3)').bind(user.id, legacy.json, legacy.updated_at).run();
      migrated = true;
    }
  }
  const s = await createSession(env, user.id, device, now);
  const st = await env.DB.prepare('SELECT updated_at FROM user_state WHERE user_id=?').bind(user.id).first();
  return { status: 200, body: { session: s.token, sessionId: s.id, user: { email: user.email, name: g.name }, owner: (await getMeta(env, 'owner_user_id')) === user.id, migrated, serverState: st ? { updatedAt: st.updated_at } : null } };
}
