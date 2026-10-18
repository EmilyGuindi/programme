import { api, apiBase, canSync, syncBlocker } from '@/store/store';
import { makeClaudeProvider, setClaudeAvailability } from './claude';
import { registerRemoteProvider } from './studio';

/** Branche Claude (via le serveur BYYND) au coach, et vérifie qu'il est configuré côté serveur. Appelé au démarrage et à l'ouverture du coach. */
export async function setupRemoteCoach() {
  registerRemoteProvider(makeClaudeProvider(async body => {
    const r = await api('/api/coach/chat', { method: 'POST', body: JSON.stringify(body) });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  }));
  if (!canSync()) { setClaudeAvailability(false, `Claude passe par ton serveur BYYND, or ${syncBlocker()}. Profil → Compte, synchronisation et Strava → Réglages avancés : saisis ta clé d'accès (ou connecte-toi avec Google).`); return; }
  try { const h = await (await fetch(apiBase() + '/api/health')).json(); setClaudeAvailability(!!h?.coach?.claude, h?.coach?.claude ? '' : `Le serveur (${apiBase().replace('https://', '')}, version ${h?.version || '?'}) n'a pas de clé Claude : vérifie le secret ANTHROPIC_API_KEY puis relance le déploiement.`); }
  catch { setClaudeAvailability(null); } // hors ligne : on tentera, avec repli sur le coach à règles
}
