import { api, apiBase, canSync } from '@/store/store';
import { makeClaudeProvider, setClaudeAvailability } from './claude';
import { registerRemoteProvider } from './studio';

/** Branche Claude (via le serveur BYYND) au coach, et vérifie qu'il est configuré côté serveur. Appelé au démarrage et à l'ouverture du coach. */
export async function setupRemoteCoach() {
  registerRemoteProvider(makeClaudeProvider(async body => {
    const r = await api('/api/coach/chat', { method: 'POST', body: JSON.stringify(body) });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  }));
  if (!canSync()) { setClaudeAvailability(false, 'Connecte ton serveur BYYND (Profil → Compte) pour parler à Claude.'); return; }
  try { const h = await (await fetch(apiBase() + '/api/health')).json(); setClaudeAvailability(!!h?.coach?.claude, h?.coach?.claude ? '' : 'Ajoute le secret ANTHROPIC_API_KEY sur GitHub pour activer Claude.'); }
  catch { setClaudeAvailability(null); } // hors ligne : on tentera, avec repli sur le coach à règles
}
