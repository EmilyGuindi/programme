import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { DEFAULT_STATE, migrate, seed } from '@/engine/state';
import type { AppState } from '@/engine/types';

const KEY = 'byynd-v2';
const SERVER_KEY = 'byynd-server';

export type SyncStatus = { status: 'local' | 'sync' | 'ok' | 'err' | 'off'; at: number; msg: string };
type Server = { url: string; key: string };

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
export async function push() {
  if (!configured()) return;
  try {
    setSync({ status: 'sync', at: Date.now(), msg: '' });
    const r = await api('/api/state', { method: 'PUT', body: JSON.stringify({ json: JSON.stringify(state), updatedAt: state.updatedAt }) });
    if (r.status === 409) { const d = await r.json(); adopt(d); setSync({ status: 'ok', at: Date.now(), msg: 'Version plus récente récupérée' }); }
    else if (r.status === 401) setSync({ status: 'err', at: Date.now(), msg: 'Clé refusée' });
    else if (r.ok) setSync({ status: 'ok', at: Date.now(), msg: '' });
    else setSync({ status: 'err', at: Date.now(), msg: `Erreur ${r.status}` });
  } catch { setSync({ status: 'off', at: Date.now(), msg: 'Hors ligne : synchro différée' }); }
}
function adopt(d: { json: string | null; updatedAt: number }) {
  if (!d.json) return;
  state = migrate(JSON.parse(d.json)); state.updatedAt = d.updatedAt; emit();
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}
export async function pull(): Promise<SyncStatus> {
  if (!configured()) return sync;
  try {
    const r = await api('/api/state');
    if (r.status === 401) { setSync({ status: 'err', at: Date.now(), msg: 'Clé refusée' }); return sync; }
    if (!r.ok) throw new Error();
    const d = await r.json();
    if (d.json && d.updatedAt > (state.updatedAt || 0)) adopt(d);
    else if ((state.updatedAt || 0) > (d.updatedAt || 0)) await push();
    setSync({ status: 'ok', at: Date.now(), msg: '' });
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
