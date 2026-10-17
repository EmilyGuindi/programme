import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { useSyncExternalStore } from 'react';
import { mergeStrava } from '@/engine/strava';
import { mergeStates } from '@/engine/merge';
import { DEFAULT_STATE, migrate, seed } from '@/engine/state';
import type { AppState } from '@/engine/types';

const KEY = 'byynd-v2';
const SERVER_KEY = 'byynd-server';

export type SyncStatus = { status: 'local' | 'sync' | 'ok' | 'err' | 'off'; at: number; msg: string };
type Server = { url: string; key: string; version?: number };

let state: AppState = seed(structuredClone(DEFAULT_STATE));
let server: Server = { url: '', key: '' };
let sync: SyncStatus = { status: 'local', at: 0, msg: '' };
let ready = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
let pushTimer: ReturnType<typeof setTimeout> | null = null;

export async function loadStore() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) state = migrate(JSON.parse(raw));
    const sv = await AsyncStorage.getItem(SERVER_KEY);
    if (sv) server = JSON.parse(sv);
  } catch {}
  ready = true; emit();
  pull();
}

/** Toute modification passe par ici : copie, mutation, persistance, synchro différée. */
export function update(fn: (s: AppState) => void) {
  const next = structuredClone(state);
  fn(next); next.updatedAt = Date.now(); state = next; emit();
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  schedulePush();
}
export function replaceState(raw: unknown) { state = migrate(raw); state.updatedAt = Date.now(); emit(); AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {}); schedulePush(); }
export const getState = () => state;

export function useApp<T = AppState>(sel?: (s: AppState) => T): T {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => (sel ? sel(state) : (state as unknown as T)));
}
export const useReady = () => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => ready);
export const useSync = () => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => sync);
export const useServer = () => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => server);

/* ---------- synchronisation avec le Worker (lot 2) ---------- */
export function setServer(next: Partial<Server>) { server = { ...server, ...next }; emit(); AsyncStorage.setItem(SERVER_KEY, JSON.stringify(server)).catch(() => {}); }
const base = () => server.url.replace(/\/$/, '');
const configured = () => !!server.url && !!server.key;
const setSync = (s: SyncStatus) => { sync = s; emit(); };
async function api(path: string, init: RequestInit = {}) {
  return fetch(base() + path, { ...init, headers: { Authorization: `Bearer ${server.key}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
}
function schedulePush() { if (!configured()) return; if (pushTimer) clearTimeout(pushTimer); pushTimer = setTimeout(push, 1500); }
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
    if (r.status === 401) setSync({ status: 'err', at: Date.now(), msg: 'Clé refusée' });
    else if (r.ok) { setServer({ version: state.updatedAt }); setSync({ status: 'ok', at: Date.now(), msg: '' }); }
    else setSync({ status: 'err', at: Date.now(), msg: `Erreur ${r.status}` });
  } catch { setSync({ status: 'off', at: Date.now(), msg: 'Hors ligne : synchro différée' }); }
  finally { pushing = false; }
}
/** Intègre la version du serveur sans rien perdre de ce qui a été fait sur ce téléphone. */
function absorb(d: { json: string | null; updatedAt: number }) {
  if (!d.json) return;
  const remote = migrate(JSON.parse(d.json));
  state = mergeStates(state, remote); state.updatedAt = Date.now(); emit();
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  setServer({ version: d.updatedAt });
}
export async function pull(): Promise<SyncStatus> {
  if (!configured()) return sync;
  try {
    const r = await api('/api/state');
    if (r.status === 401) { setSync({ status: 'err', at: Date.now(), msg: 'Clé refusée' }); return sync; }
    if (!r.ok) throw new Error();
    const d = await r.json();
    if (d.json && d.updatedAt !== (server.version ?? 0)) { absorb(d); await push(); }
    else if (!d.json || (state.updatedAt || 0) > (d.updatedAt || 0)) await push();
    setSync({ status: 'ok', at: Date.now(), msg: '' });
    stravaStatus(); pullStrava();
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
