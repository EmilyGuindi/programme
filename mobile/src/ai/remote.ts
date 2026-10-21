import { fetch as streamFetch } from 'expo/fetch';
import { api, apiBase, authHeaders, canSync, syncBlocker } from '@/store/store';
import { sseParser } from './sse';
import { makeClaudeProvider, setClaudeAvailability } from './claude';
import { registerRemoteProvider } from './studio';

let registered = false;
/** Branche Claude au coach, tout de suite (synchrone, idempotent) : appelé au chargement de l'app et de l'écran Coach.
 *  Claude est considéré disponible d'emblée ; la vérification se fait ensuite en arrière-plan. */
export function registerClaude() {
  if (registered) return; registered = true;
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
}

let lastCheck = 0;
/** Vérifie, sans bloquer l'écran, que le serveur a bien une clé Claude. Au plus une fois par minute. */
export async function setupRemoteCoach() {
  registerClaude();
  if (Date.now() - lastCheck < 60_000) return; lastCheck = Date.now();
  if (!canSync()) { lastCheck = 0; setClaudeAvailability(false, `Claude passe par ton serveur BYYND, or ${syncBlocker()}. Profil → Compte, synchronisation et Strava → Réglages avancés : saisis ta clé d'accès (ou connecte-toi avec Google).`); return; }
  try { const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    const h = await (await fetch(apiBase() + '/api/health', { signal: ctl.signal })).json(); clearTimeout(t); setClaudeAvailability(!!h?.coach?.claude, h?.coach?.claude ? '' : `Le serveur (${apiBase().replace('https://', '')}, version ${h?.version || '?'}) n'a pas de clé Claude : vérifie le secret ANTHROPIC_API_KEY puis relance le déploiement.`); }
  catch { setClaudeAvailability(null); lastCheck = 0; } // hors ligne ou lent : Claude reste proposé, avec repli sur le coach à règles
}
