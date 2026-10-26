import { DAYS_SHORT } from '@/engine/dates';
import { phasesOf } from '@/engine/coach';
import { checkCall, execute, prepare, read } from '@/engine/tools';
import { weekPreview } from '@/engine/programs';
import type { AppState, CoachCard, CoachMemory, CoachMsg, CoachThread, DataScope, ISODate, ToolCall } from '@/engine/types';
import { chatgptProvider } from './chatgpt';
import { localProvider } from './local';
import type { Attachment } from './attachments';
import type { CoachContext, CoachProvider } from './provider';

/* ============================================================
   Pipeline du coach : comprendre → choisir une fonction autorisée → vérifier les permissions → valider les paramètres
   → préparer → montrer les conséquences → confirmer → exécuter → mémoriser.
   ============================================================ */
const uid = () => Math.random().toString(36).slice(2, 10);
export const MAX_THREADS = 20, MAX_MESSAGES = 60;
/** Fournisseur distant (Claude via le serveur), enregistré par l'app au démarrage. Absent en test : coach à règles. */
let remote: CoachProvider | null = null;
export const registerRemoteProvider = (p: CoachProvider | null) => { remote = p; };
/** Claude par défaut quand il est disponible ; « Règles locales » si l'utilisatrice l'a choisi. */
export const providerFor = (s: AppState): CoachProvider => {
  const pref = s.coach?.provider;
  if (pref !== 'local' && remote && remote.status().available) return remote;
  return pref === 'chatgpt' && chatgptProvider.status().available ? chatgptProvider : localProvider;
};
export const memory = (s: AppState): CoachMemory => s.coach || { perms: {}, threads: [], decisions: [] };

/** Une demande → une réponse. Toutes les lectures et propositions passent par les contrôles de tools.ts. */
export async function ask(s: AppState, input: string, today: ISODate, history: CoachMsg[] = [], provider = providerFor(s), attachments: Attachment[] = [], onDelta?: (t: string) => void): Promise<CoachMsg> {
  const scopes = new Set<DataScope>(); const tools: string[] = []; const drafts: Record<string, unknown> = {};
  const ctx: CoachContext = {
    today, state: s, history, attachments, onDelta,
    read(call: ToolCall) {
      const c = checkCall(s, call.name, call.args); if (!c.ok) return { error: c.error };
      if (c.tool.write) return { error: 'Une écriture ne passe pas par la lecture.' };
      c.tool.scopes.forEach(x => scopes.add(x)); tools.push(c.tool.name);
      return { data: read(s, c.tool.name, c.args, today) };
    },
    propose(call: ToolCall): CoachCard | { error: string } {
      const c = checkCall(s, call.name, call.args); if (!c.ok) return { error: c.error };
      if (!c.tool.write) return { error: 'Seule une écriture se propose.' };
      c.tool.scopes.forEach(x => scopes.add(x)); tools.push(c.tool.name);
      const p = prepare(s, c.tool.name, c.args, today); const cardId = uid();
      if ((c.tool.name === 'create_program_draft' || c.tool.name === 'update_program_draft' || c.tool.name === 'change_current_program') && p.draft) {
        drafts[cardId] = p.draft;
        // La proposition est figée dans l'appel : « Accepter » applique exactement ce qui a été montré, revalidé à ce moment-là.
        const end = p.draft.end ? { end: p.draft.end } : {};
        const args = c.tool.name === 'change_current_program' ? { spec: p.draft.spec, from: p.draft.start, weeks: p.draft.weeks, name: p.draft.name, ...end }
          : c.tool.name === 'update_program_draft' ? { id: c.args.id, spec: p.draft.spec, start: p.draft.start, weeks: p.draft.weeks, name: p.draft.name, ...end }
          : { spec: p.draft.spec, start: p.draft.start, weeks: p.draft.weeks, name: p.draft.name, ...end };
        const accept = c.tool.name === 'change_current_program' ? 'Appliquer ce changement' : c.tool.name === 'update_program_draft' ? 'Mettre à jour le brouillon' : 'Enregistrer le brouillon';
        return { kind: 'program', id: cardId, accept, title: p.title, summary: c.tool.name === 'create_program_draft' ? p.summary : p.consequences.slice(0, -1).join(' ') || p.summary, phases: phasesOf(p.draft).map(x => `${x.name}, S${x.from}${x.to !== x.from ? `–S${x.to}` : ''}`),
          week: weekPreview(p.draft, 1).map(d => ({ label: DAYS_SHORT[d.dow], detail: d.detail ? `${d.label} : ${d.detail}` : d.label })), issues: p.issues.length ? p.issues : [{ severity: 'ok', text: 'Règles de sécurité BYYND respectées.' }],
          call: { name: c.tool.name, args }, modify: c.tool.name === 'update_program_draft' ? { pathname: '/programs/new', params: { id: String(c.args.id) } } : { pathname: '/programs/new', params: { spec: JSON.stringify(p.draft.spec), weeks: String(p.draft.weeks), start: p.draft.start, ...(p.draft.end ? { end: p.draft.end } : {}) } } };
      }
      return { kind: 'action', id: cardId, title: p.title, summary: p.summary, consequences: p.consequences, issues: p.executable ? p.issues : p.issues.length ? p.issues : [{ severity: 'block', text: 'Action refusée par les règles BYYND.' }], call: { name: c.tool.name, args: c.args },
        modify: c.tool.name === 'apply_workout_reschedule' ? { pathname: '/move/[date]', params: { date: String(c.args.from) } } : undefined };
    },
  };
  let reply; try { reply = await provider.respond(input, ctx); } catch { reply = { text: 'Je n\'ai pas pu traiter ta demande.', cards: [] }; }
  // Les sorties du fournisseur restent des données : textes bornés, cartes reconnues seulement.
  const cards = (reply.cards || []).filter(c => ['facts', 'week', 'compare', 'action', 'program'].includes(c.kind)).slice(0, 4);
  return { id: uid(), role: 'coach', at: Date.now(), text: String(reply.text || '').slice(0, 8000), cards, scopes: [...scopes], tools: [...new Set(tools)], memo: reply.memo?.length ? reply.memo : undefined };
}

/* ---------- Mémoire (mutations, dans update()) ---------- */
export function ensureMemory(st: AppState): CoachMemory { st.coach = st.coach || { perms: {}, threads: [], decisions: [] }; return st.coach; }
export function appendMessages(st: AppState, threadId: string | null, msgs: CoachMsg[]): string {
  const m = ensureMemory(st); let th = threadId ? m.threads.find(t => t.id === threadId) : null;
  if (!th) { th = { id: uid(), title: msgs.find(x => x.role === 'user')?.text.slice(0, 60) || 'Conversation', at: Date.now(), messages: [] }; m.threads.unshift(th); }
  th.messages.push(...msgs); th.messages = th.messages.slice(-MAX_MESSAGES); th.at = Date.now();
  for (const f of msgs.flatMap(x => x.memo || [])) addNote(st, f);
  m.threads = m.threads.sort((a, b) => b.at - a.at).slice(0, MAX_THREADS);
  return th.id;
}
/** Accepter ou refuser une carte. L'acceptation exécute l'action après de nouveaux contrôles ; la décision est mémorisée. */
export function decide(st: AppState, threadId: string, msgId: string, cardId: string, accept: boolean, today: ISODate): { ok: boolean; message: string } {
  const m = ensureMemory(st); const th = m.threads.find(t => t.id === threadId); const msg = th?.messages.find(x => x.id === msgId); const card = msg?.cards?.find(c => c.id === cardId);
  if (!th || !msg || !card || (card.kind !== 'action' && card.kind !== 'program')) return { ok: false, message: 'Proposition introuvable.' };
  if (msg.decisions?.[cardId]) return { ok: false, message: 'Déjà décidé.' };
  let res = { ok: true, message: 'Proposition refusée. Rien n\'a changé.' };
  if (accept) res = execute(st, card.call.name, card.call.args, today);
  if (!accept || res.ok) {
    msg.decisions = { ...(msg.decisions || {}), [cardId]: accept ? 'accepted' : 'refused' };
    m.decisions.unshift({ id: uid(), at: Date.now(), text: `${card.title}${accept ? ` : ${res.message}` : ''}`.slice(0, 200), outcome: accept ? 'accepted' : 'refused' });
    m.decisions = m.decisions.slice(0, 100);
  }
  return res;
}
/** Mémoire durable du coach : une phrase par information, sans doublon, 40 au plus (les plus anciennes partent). */
export const MAX_NOTES = 40;
export function addNote(st: AppState, text: string) {
  const m = ensureMemory(st); const t = text.trim().slice(0, 240); if (!t) return;
  const notes = (m.notes || []).filter(n => n.text.toLowerCase() !== t.toLowerCase());
  m.notes = [...notes, { id: uid(), at: Date.now(), text: t }].slice(-MAX_NOTES);
}
export function deleteNote(st: AppState, id: string) { const m = ensureMemory(st); m.notes = (m.notes || []).filter(n => n.id !== id); st.deleted = { ...(st.deleted || {}), [`note:${id}`]: Date.now() }; }
export function deleteThread(st: AppState, id: string) { const m = ensureMemory(st); m.threads = m.threads.filter(t => t.id !== id); st.deleted = { ...(st.deleted || {}), [`thread:${id}`]: Date.now() }; }
export function forgetAll(st: AppState) { const m = ensureMemory(st); m.threads = []; m.decisions = []; m.notes = []; m.clearedAt = Date.now(); }
export function setPerm(st: AppState, scope: DataScope, on: boolean) { const m = ensureMemory(st); m.perms = { ...m.perms, [scope]: on }; }
export const threadById = (s: AppState, id: string | null): CoachThread | null => (id ? memory(s).threads.find(t => t.id === id) || null : null);
