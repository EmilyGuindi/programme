import { coachContext } from '@/engine/tools';
import type { CoachCard, CoachMsg } from '@/engine/types';
import { localProvider } from './local';
import type { CoachProvider, CoachReply } from './provider';

/* ============================================================
   Coach conversationnel : Claude Haiku, appelé par TON serveur BYYND (la clé API n'est jamais sur le téléphone).
   Le téléphone envoie la question, un historique court et un résumé des données autorisées ; Claude répond et peut
   proposer des actions, qui repassent ici par les contrôles BYYND (ctx.propose) avant de devenir des cartes à confirmer.
   En cas d'indisponibilité (hors ligne, crédit, quota), le coach à règles répond à sa place, en le disant.
   ============================================================ */

export type Transport = (body: unknown) => Promise<{ status: number; data: any }>;
const ERR: Record<string, string> = {
  coach_not_configured: 'Claude n\'est pas encore configuré sur ton serveur',
  coach_key_invalid: 'la clé Claude du serveur est refusée',
  daily_limit: 'limite quotidienne de messages atteinte',
  attachment_too_large: 'pièce jointe trop lourde',
  bad_attachment: 'pièce jointe illisible',
  provider_busy: 'Claude est très sollicité',
  provider_rejected: 'Claude a refusé la requête (crédit épuisé ?)',
  account_required: 'connecte-toi pour utiliser Claude',
};
/** Historique texte : les propositions passées y figurent en clair, avec la décision prise. */
export function historyText(history: readonly CoachMsg[]) {
  return history.slice(-12).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.role === 'user' ? [m.text, ...(m.files || []).map(f => `[Pièce jointe déjà vue : ${f.name}]`)].join('\n')
    : [m.text, ...(m.cards || []).filter(c => c.kind === 'action' || c.kind === 'program').map(c => `[Proposition « ${c.title} » : ${m.decisions?.[c.id] === 'accepted' ? 'acceptée' : m.decisions?.[c.id] === 'refused' ? 'refusée' : 'en attente'}]`)].join('\n') }));
}

let available: boolean | null = null; let detail = '';
export function setClaudeAvailability(ok: boolean | null, why = '') { available = ok; detail = why; }
export const remoteDetail = () => available === false ? detail || 'Raison inconnue.' : available === null ? 'Vérification en cours…' : '';

export function makeClaudeProvider(send: Transport): CoachProvider {
  return {
    id: 'claude', name: 'Claude',
    status: () => available === false ? { available: false, label: 'Indisponible', detail: detail || 'Claude n\'est pas configuré sur ton serveur.' }
      : { available: true, label: 'Actif', detail: 'Claude Haiku, via ton serveur BYYND. Il voit les données que tu autorises ci-dessous.' },
    async respond(input, ctx): Promise<CoachReply> {
      const fallback = async (why: string) => { const r = await localProvider.respond(input, ctx); return { ...r, text: `(${why} : réponse du coach à règles${ctx.attachments?.length ? ', qui ne lit pas les pièces jointes' : ''}.) ${r.text}` }; };
      let res;
      const attachments = (ctx.attachments || []).map(a => a.kind === 'image' ? { kind: 'image', mediaType: a.mediaType, data: a.data, name: a.name } : a.kind === 'pdf' ? { kind: 'pdf', data: a.data, name: a.name } : { kind: 'text', text: a.text, name: a.name });
      try { res = await send({ messages: [...historyText(ctx.history), { role: 'user', text: input.slice(0, 2000) || 'Regarde la pièce jointe.' }], context: coachContext(ctx.state as any, ctx.today), attachments }); }
      catch { return fallback('Hors ligne'); }
      if (res.status !== 200) { if (res.data?.error === 'coach_not_configured') setClaudeAvailability(false); return fallback(ERR[res.data?.error] || `erreur ${res.status}`); }
      const cards: CoachCard[] = []; const notes: string[] = [];
      for (const call of (Array.isArray(res.data.calls) ? res.data.calls : []).slice(0, 3)) {
        const c = ctx.propose({ name: String(call?.name), args: call?.args && typeof call.args === 'object' ? call.args : {} });
        if ('error' in c) notes.push(`Proposition écartée par les règles BYYND : ${c.error}`); else cards.push(c);
      }
      const text = [String(res.data.text || '').trim() || (cards.length ? 'Voici ma proposition.' : '…'), ...notes].join('\n\n');
      return { text: res.data.truncated ? `${text}\n\n(Réponse coupée : repose ta question plus précisément.)` : text, cards };
    },
  };
}
