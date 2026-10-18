// Tests de sécurité du Worker : jetons Google, sessions, cloisonnement des données, migration, sauvegardes.
// Base D1 simulée par node:sqlite (même SQL que la production). Lancer : node --test worker/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../index.js';
import { b64url, verifyGoogleIdToken } from '../auth.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
  });
  return { prepare: sql => stmt(sql) };
}
const AUD = 'web-client.apps.googleusercontent.com';
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'k1' };
const enc = new TextEncoder();
async function idToken(claims, kid = 'k1', key = kp.privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(enc.encode(JSON.stringify({ alg: 'RS256', kid })));
  const p = b64url(enc.encode(JSON.stringify({ iss: 'https://accounts.google.com', aud: AUD, sub: 's-emily', email: 'emily@example.com', email_verified: true, iat: now, exp: now + 3600, ...claims })));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(sig)}`;
}
// Les clés publiques Google sont servies par un fetch simulé.
globalThis.fetch = async url => { if (String(url).includes('oauth2/v3/certs')) return new Response(JSON.stringify({ keys: [jwk] })); throw new Error('réseau interdit en test: ' + url); };

const env = () => ({ DB: d1(), APP_KEY: 'legacy-key-123', GOOGLE_WEB_CLIENT_ID: AUD });
const call = async (e, method, path, { token, body, legacy } = {}) => {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = `Bearer ${token}`; if (legacy) h['X-Legacy-Key'] = legacy;
  const r = await worker.fetch(new Request(`https://byynd.test${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined }), e, { waitUntil() {} });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const login = async (e, claims = {}, legacy) => call(e, 'POST', '/api/auth/google', { body: { idToken: await idToken(claims), device: 'Pixel test' }, legacy });

test('jeton Google : signature, audience, expiration, e-mail vérifié', async () => {
  const keys = async () => [jwk];
  assert.equal((await verifyGoogleIdToken(await idToken({}), [AUD], { keys })).email, 'emily@example.com');
  await assert.rejects(verifyGoogleIdToken(await idToken({ aud: 'autre' }), [AUD], { keys }), /audience/);
  await assert.rejects(verifyGoogleIdToken(await idToken({ exp: 1000 }), [AUD], { keys }), /expired/);
  await assert.rejects(verifyGoogleIdToken(await idToken({ email_verified: false }), [AUD], { keys }), /email/);
  await assert.rejects(verifyGoogleIdToken(await idToken({ iss: 'evil.com' }), [AUD], { keys }), /issuer/);
  const other = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  await assert.rejects(verifyGoogleIdToken(await idToken({}, 'k1', other.privateKey), [AUD], { keys }), /signature/);
  const t = await idToken({}); const [h, , s] = t.split('.');
  const forged = `${h}.${b64url(enc.encode(JSON.stringify({ iss: 'accounts.google.com', aud: AUD, sub: 'x', email: 'x@x', email_verified: true, exp: 9e9 })))}.${s}`;
  await assert.rejects(verifyGoogleIdToken(forged, [AUD], { keys }), /signature/);
});

test('sans session ni clé : tout est refusé', async () => {
  const e = env();
  assert.equal((await call(e, 'GET', '/api/state')).status, 401);
  assert.equal((await call(e, 'GET', '/api/state', { token: 'au-hasard' })).status, 401);
});

test('migration : la clé historique rattache les données existantes au compte, avec sauvegarde, sans rien écraser', async () => {
  const e = env();
  assert.equal((await call(e, 'PUT', '/api/state', { token: 'legacy-key-123', body: { json: '{"v":3,"activities":[1,2,3]}', updatedAt: 111, base: 0 } })).status, 200);
  const r = await login(e, {}, 'legacy-key-123');
  assert.equal(r.status, 200); assert.equal(r.body.migrated, true); assert.equal(r.body.owner, true); assert.ok(r.body.session.length > 30);
  const st = await call(e, 'GET', '/api/state', { token: r.body.session });
  assert.equal(st.body.json, '{"v":3,"activities":[1,2,3]}'); assert.equal(st.body.updatedAt, 111);
  const b = await call(e, 'GET', '/api/backups', { token: r.body.session });
  assert.equal(b.body.backups[0].reason, 'avant rattachement au compte');
  // L'ancienne app (clé) continue d'écrire dans le même compte.
  assert.equal((await call(e, 'GET', '/api/state', { token: 'legacy-key-123' })).body.updatedAt, 111);
  // Une seconde connexion ne refait pas la migration.
  assert.equal((await login(e, {}, 'legacy-key-123')).body.migrated, false);
});

test('instance personnelle : un second compte Google est refusé (sauf liste ALLOWED_EMAILS)', async () => {
  const e = env(); await login(e);
  assert.equal((await login(e, { sub: 's-intrus', email: 'intrus@example.com' })).status, 403);
  e.ALLOWED_EMAILS = 'emily@example.com, ami@example.com';
  assert.equal((await login(e, { sub: 's-ami', email: 'ami@example.com' })).status, 200);
});

test('cloisonnement : impossible de lire ou révoquer les données d\'un autre compte', async () => {
  const e = { ...env(), ALLOWED_EMAILS: 'emily@example.com,ami@example.com' };
  const a = (await login(e)).body, b = (await login(e, { sub: 's-ami', email: 'ami@example.com' })).body;
  await call(e, 'PUT', '/api/state', { token: a.session, body: { json: '{"secret":"A"}', updatedAt: 5, base: -1 } });
  const asB = await call(e, 'GET', '/api/state', { token: b.session });
  assert.equal(asB.body.json, null, 'B ne voit rien de A');
  assert.equal((await call(e, 'DELETE', `/api/auth/sessions/${a.sessionId}`, { token: b.session })).status, 404, 'B ne peut pas révoquer la session de A');
  assert.equal((await call(e, 'GET', '/api/state', { token: a.session })).body.json, '{"secret":"A"}');
  assert.equal((await call(e, 'GET', '/api/activities', { token: b.session })).status, 403, 'Strava réservé au propriétaire');
});

test('concurrence : une version non vue n\'est jamais écrasée (409 + version serveur)', async () => {
  const e = env(); const s = (await login(e)).body.session;
  assert.equal((await call(e, 'PUT', '/api/state', { token: s, body: { json: '{"n":1}', updatedAt: 10, base: -1 } })).status, 200);
  const r = await call(e, 'PUT', '/api/state', { token: s, body: { json: '{"n":0}', updatedAt: 9, base: 3 } });
  assert.equal(r.status, 409); assert.equal(r.body.json, '{"n":1}');
});

test('sessions : liste, déconnexion, déconnexion de tous les appareils', async () => {
  const e = env(); const a = (await login(e)).body; const b = (await login(e)).body;
  const list = await call(e, 'GET', '/api/auth/sessions', { token: a.session });
  assert.equal(list.body.sessions.length, 2); assert.ok(list.body.sessions.some(x => x.current));
  assert.equal((await call(e, 'DELETE', `/api/auth/sessions/${b.sessionId}`, { token: a.session })).status, 200);
  assert.equal((await call(e, 'GET', '/api/state', { token: b.session })).status, 401, 'appareil déconnecté');
  await call(e, 'POST', '/api/auth/logout-all', { token: a.session });
  assert.equal((await call(e, 'GET', '/api/state', { token: a.session })).status, 401);
});

test('sauvegardes : restauration, avec sauvegarde préalable de l\'état courant', async () => {
  const e = env(); await call(e, 'PUT', '/api/state', { token: 'legacy-key-123', body: { json: '{"v":"ancien"}', updatedAt: 1, base: 0 } });
  const s = (await login(e, {}, 'legacy-key-123')).body.session;
  await call(e, 'PUT', '/api/state', { token: s, body: { json: '{"v":"nouveau"}', updatedAt: 2, base: 1 } });
  const id = (await call(e, 'GET', '/api/backups', { token: s })).body.backups.at(-1).id;
  const r = await call(e, 'POST', `/api/backups/${id}/restore`, { token: s });
  assert.equal(r.body.json, '{"v":"ancien"}');
  assert.equal((await call(e, 'GET', '/api/backups', { token: s })).body.backups[0].reason, 'avant restauration');
});

test('suppression du compte : confirmation exigée', async () => {
  const e = env(); const s = (await login(e)).body.session;
  assert.equal((await call(e, 'DELETE', '/api/account', { token: s })).status, 400);
  assert.equal((await call(e, 'DELETE', '/api/account?confirm=SUPPRIMER', { token: s })).status, 200);
  assert.equal((await call(e, 'GET', '/api/state', { token: s })).status, 401);
});
