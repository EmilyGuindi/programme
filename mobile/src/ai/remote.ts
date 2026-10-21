import { fetch as streamFetch } from 'expo/fetch';
import { api, apiBase, authHeaders, canSync, syncBlocker } from '@/store/store';
import { sseParser } from './sse';
import { makeClaudeProvider, setClaudeAvailability } from './claude';
import { registerRemoteProvider } from './studio';

/** Branche Claude (via le serveur BYYND) au coach, et vérifie qu'il est configuré côté serveur. Appelé au démarrage et à l'ouverture du coach. */
export async function setupRemoteCoach() {
  registerRemoteProvider(makeClaudeProvider(async (body, onDelta) => {
    if (onDelta) {
      // Réponse en direct : le texte s'affiche pendant que Claude l'écrit (fetch d'Expo, qui sait lire un flux).
      try {
        const r = await streamFetch(apiBase() + '/api/coach/chat', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...(body as object), stream: true }) });
        if (r.status !== 200 || !r.body || !(r.headers.get('content-type') || '').includes('event-stream')) return { status: r.status, data: await r.json().catch(() => ({})) };
        let text = '', done: any = null, error: any = null;
        const feed = sseParser((ev, data) => { if (ev === 'delta') { text += data.text || ''; onDelta(text); } else if (ev === 'done') done = data; else if (ev === 'error') error = data; });
        const reader = r.body.getReader(); const dec = new TextDecoder();
        for (;;) { const { value, done: end } = await reader.read(); if (end) break; feed(dec.decode(value, { stream: true })); }
        if (done) return { status: 200, data: done };
        return { status: 502, data: error || { error: 'provider_unreachable' } };
      } catch { /* flux indisponible : on retente sans */ }
    }
    const r = await api('/api/coach/chat', { method: 'POST', body: JSON.stringify(body) });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  }));
  if (!canSync()) { setClaudeAvailability(false, `Claude passe par ton serveur BYYND, or ${syncBlocker()}. Profil → Compte, synchronisation et Strava → Réglages avancés : saisis ta clé d'accès (ou connecte-toi avec Google).`); return; }
  try { const h = await (await fetch(apiBase() + '/api/health')).json(); setClaudeAvailability(!!h?.coach?.claude, h?.coach?.claude ? '' : `Le serveur (${apiBase().replace('https://', '')}, version ${h?.version || '?'}) n'a pas de clé Claude : vérifie le secret ANTHROPIC_API_KEY puis relance le déploiement.`); }
  catch { setClaudeAvailability(null); } // hors ligne : on tentera, avec repli sur le coach à règles
}
