import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { useSyncExternalStore } from 'react';
import { fillEventResults, mergeStrava } from '@/engine/strava';
import { mergeStates } from '@/engine/merge';
import { DEFAULT_STATE, migrate, seed } from '@/engine/state';
import type { AppState } from '@/engine/types';
import { secureDel, secureGet, secureSet } from '@/secure';

const KEY = 'byynd-v2';
const SERVER_KEY = 'byynd-server';
/** Serveur BYYND par défaut (adresse publique, sans secret) : un nouvel appareil n'a qu'à se connecter avec Google. */
export const DEFAULT_URL = 'https://byynd.emilyguindi.workers.dev';

/** pending : des modifications locales attendent d'être envoyées (hors ligne, erreur) — elles sont en sécurité sur le téléphone. */
export type SyncStatus = { status: 'local' | 'sync' | 'ok' | 'err' | 'off' | 'pending'; at: number; msg: string; lastOk?: number };
/** Les secrets (key, session) ne sont jamais écrits dans AsyncStorage : ils vivent dans le stockage sécurisé. */
type Server = { url: string; key: string; session?: string; version?: number; account?: { email: string; name?: string | null; owner?: boolean } | null };

let state: AppState = seed(structuredClone(DEFAULT_STATE));
let server: Server = { url: DEFAULT_URL, key: '' };
let sync: SyncStatus = { status: 'local', at: 0, msg: '' };
let ready = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
let pushTimer: ReturnType<typeof setTimeout> | null = null;

export async function loadStore() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) { const before = JSON.parse(raw); state = migrate(before); if (before.v !== state.v) persist(); }
    const sv = await AsyncStorage.getItem(SERVER_KEY);
    if (sv) server = { ...server, ...JSON.parse(sv) };
    // Migration : l'ancienne version gardait la clé en clair ; elle passe dans le stockage sécurisé.
    if (server.key) { await secureSet('byynd-key', server.key); saveServerMeta(); }
    server.key = (await secureGet('byynd-key')) || server.key || '';
    server.session = (await secureGet('byynd-session')) || undefined;
    if (!server.url) server.url = DEFAULT_URL;
  } catch {}
  ready = true; emit();
  if (fillEventResults(structuredClone(state))) update(st => { fillEventResults(st); });
  pull();
}

/** Écritures disque en file : la dernière version écrite est toujours la dernière version connue, même si deux écritures se suivent de près. */
let writing: Promise<void> = Promise.resolve();
let dirty = false;
function persist() {
  dirty = true;
  writing = writing.then(async () => { if (!dirty) return; dirty = false; try { await AsyncStorage.setItem(KEY, JSON.stringify(state)); } catch { dirty = true; } });
  return writing;
}
/** À appeler quand l'app passe en arrière-plan : termine l'écriture locale et tente l'envoi au serveur tout de suite. */
export async function flush() { await persist(); if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; push(); } }

/** Toute modification passe par ici : copie, mutation, affichage immédiat (optimiste), persistance locale, synchro différée. */
export function update(fn: (s: AppState) => void) {
  const next = structuredClone(state);
  fn(next); next.updatedAt = Date.now(); state = next; emit();
  persist();
  schedulePush();
}
export function replaceState(raw: unknown) { state = migrate(raw); state.updatedAt = Date.now(); emit(); persist(); schedulePush(); }
export const getState = () => state;

export function useApp<T = AppState>(sel?: (s: AppState) => T): T {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => (sel ? sel(state) : (state as unknown as T)));
}
export const useReady = () => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => ready);
export const useSync = () => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => sync);
export const useServer = () => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => server);

/* ---------- synchronisation avec le Worker (lot 2) ---------- */
function saveServerMeta() { const { key: _k, session: _s, ...meta } = server; AsyncStorage.setItem(SERVER_KEY, JSON.stringify(meta)).catch(() => {}); }
export function setServer(next: Partial<Server>) {
  server = { ...server, ...next }; emit();
  if ('key' in next) { if (next.key) secureSet('byynd-key', next.key); else secureDel('byynd-key'); }
  if ('session' in next) { if (next.session) secureSet('byynd-session', next.session); else secureDel('byynd-session'); }
  saveServerMeta();
}
const base = () => server.url.replace(/\/$/, '');
const configured = () => !!server.url && !!(server.session || server.key);
export const hasAccount = () => !!server.session;
const setSync = (s: SyncStatus) => { sync = { lastOk: sync.lastOk, ...s, ...(s.status === 'ok' ? { lastOk: s.at } : {}) }; emit(); };
/** Appel authentifié : session du compte en priorité, clé historique sinon. Une session refusée est oubliée (reconnexion demandée). */
export async function api(path: string, init: RequestInit = {}) {
  const tok = server.session || server.key;
  const r = await fetch(base() + path, { ...init, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  if (r.status === 401 && server.session && tok === server.session) { setServer({ session: undefined, account: null }); setSync({ status: 'err', at: Date.now(), msg: 'Session expirée : reconnecte-toi avec Google' }); }
  return r;
}
export const apiBase = () => base();
/** Réessais hors ligne : 30 s, 1 min, 2 min… jusqu'à 10 min, tant que des modifications attendent. */
let retryDelay = 30_000, retryTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleRetry() { if (retryTimer) return; retryTimer = setTimeout(() => { retryTimer = null; push(); }, retryDelay); retryDelay = Math.min(retryDelay * 2, 600_000); }
function schedulePush() { if (!configured()) return; if (pushTimer) clearTimeout(pushTimer); pushTimer = setTimeout(push, 1500); if (sync.status === 'ok' || sync.status === 'local') setSync({ status: 'pending', at: Date.now(), msg: 'Modifications enregistrées sur le téléphone' }); }
let pushing = false;
export async function push(retry = true): Promise<void> {
  if (!configured() || pushing) return;
  pushing = true;
  try {
    setSync({ status: 'sync', at: Date.now(), msg: '' });
    const r = await api('/api/state', { method: 'PUT', body: JSON.stringify({ json: JSON.stringify(state), updatedAt: state.updatedAt, base: server.version ?? 0 }) });
    if (r.status === 409) {
      // modifié ailleurs entre-temps : on fusionne au lieu d'écraser, puis on renvoie
      const d = await r.json(); absorb(d);
      pushing = false; if (retry) return push(false); return;
    }
    if (r.status === 401) setSync({ status: 'err', at: Date.now(), msg: server.session ? 'Session refusée' : 'Accès refusé : connecte-toi avec Google' });
    else if (r.ok) { setServer({ version: state.updatedAt }); setSync({ status: 'ok', at: Date.now(), msg: '' }); retryDelay = 30_000; }
    else { setSync({ status: 'err', at: Date.now(), msg: `Erreur ${r.status} : nouvel essai bientôt` }); scheduleRetry(); }
  } catch { setSync({ status: 'off', at: Date.now(), msg: 'Hors ligne : tes modifications sont gardées et partiront à la reconnexion' }); scheduleRetry(); }
  finally { pushing = false; }
}
/** Intègre la version du serveur sans rien perdre de ce qui a été fait sur ce téléphone. */
function absorb(d: { json: string | null; updatedAt: number }) {
  if (!d.json) return;
  const remote = migrate(JSON.parse(d.json));
  // Téléphone neuf (état de départ jamais modifié) : la version du serveur est reprise telle quelle, sans y mêler les valeurs par défaut.
  state = state.updatedAt === 0 ? remote : mergeStates(state, remote); state.updatedAt = Date.now(); emit();
  persist();
  setServer({ version: d.updatedAt });
}
/** Résumé lisible d'un état, pour comparer téléphone et serveur avant un rattachement. */
export type Counts = { activities: number; measurements: number; checkins: number; sessions: number; updatedAt: number };
export const countsOf = (x: AppState): Counts => ({ activities: x.activities.length, measurements: x.measurements.length, checkins: Object.keys(x.checkins || {}).length,
  sessions: Object.keys(x.strength || {}).length + Object.keys(x.runs || {}).length, updatedAt: x.updatedAt || 0 });
export const parseRemote = (json: string) => migrate(JSON.parse(json));
/** Fusion explicite avec la version du serveur (rien n'est perdu), puis envoi. */
export async function mergeRemote(d: { json: string | null; updatedAt: number }) { if (d.json) absorb(d); else setServer({ version: d.updatedAt || 0 }); await push(); }
/** Remplace l'état du téléphone par une version du serveur (restauration, choix explicite). */
export function adoptRemote(d: { json: string; updatedAt: number }) { state = migrate(JSON.parse(d.json)); emit(); persist(); setServer({ version: d.updatedAt }); setSync({ status: 'ok', at: Date.now(), msg: '' }); }

export async function pull(): Promise<SyncStatus> {
  if (!configured()) return sync;
  try {
    const r = await api('/api/state');
    if (r.status === 401) { setSync({ status: 'err', at: Date.now(), msg: 'Accès refusé : connecte-toi avec Google' }); return sync; }
    if (!r.ok) throw new Error();
    const d = await r.json();
    if (d.json && d.updatedAt !== (server.version ?? 0)) { absorb(d); await push(); }
    else if (!d.json || (state.updatedAt || 0) > (d.updatedAt || 0)) await push();
    setSync({ status: 'ok', at: Date.now(), msg: '' });
    stravaStatus(); pullStrava().then(() => autoFillCalories());
  } catch { setSync({ status: 'off', at: Date.now(), msg: 'Serveur injoignable' }); }
  return sync;
}
export async function testServer(): Promise<string> {
  try {
    const h = await fetch(base() + '/api/health'); const d = await h.json();
    if (!d.ok) return 'Réponse inattendue';
    const k = await api('/api/state');
    return k.status === 401 ? 'Serveur OK, clé refusée' : k.ok ? 'Serveur et clé OK' : `Serveur OK, erreur ${k.status}`;
  } catch { return 'Serveur injoignable'; }
}

/* ---------- Strava (lot 4) ---------- */
export type StravaStatus = { configured: boolean; connected: boolean; athlete: string | null; lastSync: number | null; error: string | null };
let strava: StravaStatus | null = null;
export const useStrava = () => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => strava);
export async function stravaStatus() {
  if (!configured()) return null;
  try { const r = await api('/api/strava/status'); if (r.ok) { strava = await r.json(); emit(); } else { strava = null; emit(); } } catch { strava = null; emit(); }
  return strava;
}
/** Récupère les activités Strava normalisées par le serveur et les fusionne localement. */
export async function pullStrava() {
  if (!configured()) return 0;
  try {
    let since = state.strava?.since || 0, total = 0;
    for (let i = 0; i < 6; i++) {
      const r = await api(`/api/activities?since=${since}`); if (!r.ok) break;
      const d = await r.json(); if (!d.items.length) break;
      update(st => { mergeStrava(st, d.items); st.strava = { since: d.until }; });
      since = d.until; total += d.items.length; if (d.items.length < 500) break;
    }
    return total;
  } catch { return 0; }
}
export async function stravaSyncNow(days = 14) {
  try { await api(`/api/strava/sync?days=${days}`, { method: 'POST' }); } catch {}
  await stravaStatus(); return pullStrava();
}
export async function connectStrava(): Promise<string> {
  if (!configured()) return 'Configure d\'abord le serveur BYYND.';
  try {
    const r = await api('/api/strava/connect-url'); if (r.status === 503) return 'Strava n\'est pas encore configuré côté serveur.';
    const { url } = await r.json();
    const res = await WebBrowser.openAuthSessionAsync(url, 'byynd://strava');
    if (res.type === 'success' && /ok=1/.test(res.url)) { await stravaStatus(); setTimeout(() => stravaSyncNow(90), 4000); return 'Strava connecté. Import de tes 90 derniers jours en cours.'; }
    return res.type === 'success' ? 'Connexion refusée ou annulée.' : 'Connexion annulée.';
  } catch { return 'Serveur injoignable.'; }
}
export async function disconnectStrava() { try { await api('/api/strava/disconnect', { method: 'POST' }); } catch {} await stravaStatus(); }

/** Demande au serveur de compléter l'énergie des activités Strava (par petits lots), puis récupère les valeurs. */
export async function fillCaloriesNow(): Promise<string> {
  if (!configured()) return 'Serveur non configuré.';
  try { const r = await api('/api/strava/calories', { method: 'POST' }); if (!r.ok) return 'Strava indisponible pour le moment, réessaie plus tard.'; const d = await r.json(); await pullStrava(); return d.completed ? `${d.completed} activité${d.completed > 1 ? 's' : ''} vérifiée${d.completed > 1 ? 's' : ''}.` : 'Rien de plus à récupérer pour l\'instant.'; }
  catch { return 'Serveur injoignable.'; }
}

/** Au plus toutes les 6 h : si des activités Strava n'ont pas encore leur estimation, on demande au serveur de les compléter. */
async function autoFillCalories() {
  const pending = state.activities.some(a => a.source === 'strava' && (a.caloriesStatus === 'pending' || a.caloriesStatus === undefined));
  if (!pending || Date.now() - (state.strava?.fillAt || 0) < 6 * 3600_000) return;
  update(st => { st.strava = { since: st.strava?.since || 0, fillAt: Date.now() }; });
  try { const r = await api('/api/strava/calories', { method: 'POST' }); if (r.ok) await pullStrava(); } catch {}
}
