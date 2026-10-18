import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { adoptRemote, api, apiBase, countsOf, getState, mergeRemote, parseRemote, setServer, type Counts } from '@/store/store';

/** Compte BYYND : connexion Google (identité seulement, scopes openid/email/profil), session vérifiée par le serveur.
 *  Aucun accès Gmail ou Drive n'est demandé. Le jeton Google ne sert qu'une fois : le serveur le vérifie et remet une session BYYND. */
export const LOCAL_BACKUP = 'byynd-backup-before-account';

type GS = typeof import('@react-native-google-signin/google-signin');
function googleModule(): GS | null {
  if (Platform.OS === 'web') return null;
  try { return require('@react-native-google-signin/google-signin') as GS; } catch { return null; } // APK antérieur à la 5.0
}

export type LinkPreview = { local: Counts; server: Counts | null; serverJson: string | null; serverUpdatedAt: number; migrated: boolean; email: string };
export type SignInResult = { ok: true; preview: LinkPreview } | { ok: false; message: string };

const deviceName = () => [Device.manufacturer, Device.modelName].filter(Boolean).join(' ').slice(0, 60) || (Platform.OS === 'android' ? 'Android' : Platform.OS);

export async function signInWithGoogle(legacyKey: string): Promise<SignInResult> {
  const G = googleModule();
  if (!G) return { ok: false, message: Platform.OS === 'web' ? 'La connexion Google se fait depuis l\'application Android.' : 'Installe le nouvel APK BYYND (5.0) pour te connecter avec Google.' };
  let clientId: string | null = null;
  try { const h = await (await fetch(apiBase() + '/api/health')).json(); clientId = h?.google?.clientId || null; } catch { return { ok: false, message: 'Serveur injoignable. Vérifie ta connexion.' }; }
  if (!clientId) return { ok: false, message: 'Le serveur n\'a pas encore d\'identifiant Google (secret GOOGLE_WEB_CLIENT_ID).' };
  let idToken: string | null = null;
  try {
    G.GoogleSignin.configure({ webClientId: clientId, scopes: [] }); // identité seulement
    await G.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const r = await G.GoogleSignin.signIn();
    if (!G.isSuccessResponse(r)) return { ok: false, message: 'Connexion annulée.' };
    idToken = r.data.idToken;
  } catch (e: any) {
    if (e?.code === G.statusCodes.IN_PROGRESS) return { ok: false, message: 'Connexion déjà en cours.' };
    if (e?.code === G.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return { ok: false, message: 'Services Google Play indisponibles sur ce téléphone.' };
    return { ok: false, message: 'Google a refusé la connexion. Vérifie la configuration du client Android (empreinte SHA-1).' };
  }
  if (!idToken) return { ok: false, message: 'Google n\'a pas renvoyé d\'identité. Vérifie l\'identifiant client Web.' };

  // Avant tout rattachement : copie intégrale de ce téléphone, restaurable depuis Compte et sécurité.
  try { await AsyncStorage.setItem(LOCAL_BACKUP, JSON.stringify({ at: Date.now(), state: getState() })); } catch {}

  let d: any;
  try {
    const r = await fetch(apiBase() + '/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(legacyKey ? { 'X-Legacy-Key': legacyKey } : {}) }, body: JSON.stringify({ idToken, device: deviceName() }) });
    d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, message: d.error === 'account_not_allowed' ? 'Ce compte Google n\'est pas autorisé sur ce serveur BYYND.' : d.error === 'google_not_configured' ? 'Le serveur n\'a pas encore d\'identifiant Google.' : 'Le serveur n\'a pas pu vérifier ton identité Google.' };
  } catch { return { ok: false, message: 'Serveur injoignable. Vérifie ta connexion.' }; }
  // La clé historique n'est plus utilisée une fois la session obtenue (elle reste en stockage sécurisé jusqu'à la déconnexion).
  setServer({ session: d.session, account: { email: d.user.email, name: d.user.name, owner: d.owner }, version: undefined });
  const st = await api('/api/state').then(r => r.json()).catch(() => ({ json: null, updatedAt: 0 }));
  return { ok: true, preview: { local: countsOf(getState()), server: st.json ? countsOf(parseRemote(st.json)) : null, serverJson: st.json, serverUpdatedAt: st.updatedAt || 0, migrated: !!d.migrated, email: d.user.email } };
}

/** Étape 2 du rattachement, toujours choisie par l'utilisatrice : fusionner (rien n'est perdu) ou reprendre la version du compte. */
export async function finishLink(p: LinkPreview, choice: 'merge' | 'server') {
  if (choice === 'server' && p.serverJson) adoptRemote({ json: p.serverJson, updatedAt: p.serverUpdatedAt });
  else await mergeRemote({ json: p.serverJson, updatedAt: p.serverUpdatedAt });
}

export async function localBackup(): Promise<{ at: number; counts: Counts } | null> {
  try { const raw = await AsyncStorage.getItem(LOCAL_BACKUP); if (!raw) return null; const b = JSON.parse(raw); return { at: b.at, counts: countsOf(parseRemote(JSON.stringify(b.state))) }; } catch { return null; }
}
export async function restoreLocalBackup() {
  const raw = await AsyncStorage.getItem(LOCAL_BACKUP); if (!raw) return false;
  const { replaceState } = await import('@/store/store'); replaceState(JSON.parse(raw).state); return true;
}

export type DeviceSession = { id: string; device: string; created_at: number; last_seen: number; current: boolean };
export async function listSessions(): Promise<DeviceSession[]> { try { const r = await api('/api/auth/sessions'); return r.ok ? (await r.json()).sessions : []; } catch { return []; } }
export async function revokeSession(id: string) { try { return (await api(`/api/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })).ok; } catch { return false; } }

export type ServerBackup = { id: number; updated_at: number; created_at: number; reason: string; size: number };
export async function listBackups(): Promise<ServerBackup[]> { try { const r = await api('/api/backups'); return r.ok ? (await r.json()).backups : []; } catch { return []; } }
export async function restoreBackup(id: number) {
  const r = await api(`/api/backups/${id}/restore`, { method: 'POST' }); if (!r.ok) return false;
  const d = await r.json(); adoptRemote({ json: d.json, updatedAt: d.updatedAt }); return true;
}

async function forget() { const G = googleModule(); try { await G?.GoogleSignin.signOut(); } catch {} setServer({ session: undefined, key: '', account: null, version: undefined }); }
/** Déconnexion de ce téléphone : la session est révoquée côté serveur ; les données restent sur le téléphone et sur le compte. */
export async function logout() { try { await api('/api/auth/logout', { method: 'POST' }); } catch {} await forget(); }
export async function logoutAll() { try { await api('/api/auth/logout-all', { method: 'POST' }); } catch {} await forget(); }
/** Supprime le compte et ses données serveur (états, sauvegardes, sessions). Le téléphone garde sa copie locale. */
export async function deleteAccount() { const r = await api('/api/account?confirm=SUPPRIMER', { method: 'DELETE' }); if (r.ok) await forget(); return r.ok; }
