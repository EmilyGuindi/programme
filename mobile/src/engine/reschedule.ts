import { adapted, basePlan, doneOn, eventOn, moveMap, planFor, recovery } from './coach';
import { addDays, daysBetween, dow, fmtDay } from './dates';
import type { AppState, ISODate, Plan } from './types';

/* ============================================================
   Replanification : déplacer une séance de running ou de renforcement.
   La séance garde son identifiant (sa date d'origine), son contenu, ses coches et ses charges.
   Avant validation, le coach vérifie : jour occupé, CrossFit et HYROX, compétitions, récupération,
   douleur et fatigue signalées, plafond de 4 jours d'entraînement (+ 1 facultatif).
   Il ne bloque que les cas sans issue (jour de compétition, date passée, séance déjà faite).
   ============================================================ */

export type Severity = 'ok' | 'info' | 'warn' | 'block';
export interface MoveIssue { code: string; severity: Severity; text: string }
export interface MoveCheck {
  origin: ISODate; from: ISODate; to: ISODate; session: string;
  verdict: 'ok' | 'warn' | 'block'; issues: MoveIssue[];
  /** Le jour visé a déjà une séance déplaçable : proposer d'échanger les deux. */ swapWith: { date: ISODate; title: string } | null;
  alternatives: { date: ISODate; label: string }[]; result: string;
}

const TRAIN = (p: Plan) => p.type === 'run' || p.type === 'box' || p.type === 'renfo' || p.type === 'event' || p.type === 'recup';
const hard = (p: Plan) => p.type === 'box' || p.type === 'event' || (p.type === 'run' && !!p.run && (p.run.kind === 'qualite' || p.run.kind === 'test'));
const label = (d: ISODate) => `${fmtDay(d).charAt(0).toUpperCase()}${fmtDay(d).slice(1)}`;

/** La séance visible ce jour-là peut-elle être déplacée ? (running ou renforcement, pas encore faite) */
export function movable(s: AppState, d: ISODate, today: ISODate): { ok: boolean; why?: string } {
  const p = planFor(s, d);
  if (p.type !== 'run' && p.type !== 'renfo') return { ok: false, why: 'Seuls le running et le renforcement se déplacent : la box et les courses ont leurs horaires.' };
  if (doneOn(s, d)) return { ok: false, why: 'Séance déjà faite.' };
  if (d < today) return { ok: false, why: 'Séance passée.' };
  return { ok: true };
}

/** Plan de la semaine si la séance d'origine `origin` passait au jour `to` (sans rien enregistrer). */
function simulate(s: AppState, origin: ISODate, to: ISODate, swap?: ISODate): AppState {
  const r = structuredClone(s.reschedule || { moves: {}, habits: [], habitsAt: 0 });
  r.moves[origin] = { to, at: 1 };
  if (swap) r.moves[swap] = { to: origin === to ? swap : currentDate(s, origin), at: 1 };
  return { ...s, reschedule: r };
}
const currentDate = (s: AppState, origin: ISODate) => moveMap(s).to.get(origin) ?? origin;

export function checkMove(s: AppState, from: ISODate, to: ISODate, today: ISODate, withAlternatives = true): MoveCheck {
  const shown = planFor(s, from); const origin = shown.movedFrom || from; const session = shown.title;
  const issues: MoveIssue[] = []; const add = (code: string, severity: Severity, text: string) => issues.push({ code, severity, text });
  const target = planFor(s, to); let swapWith: MoveCheck['swapWith'] = null;

  // 1. Cas sans issue
  if (to === from) add('same', 'block', 'C\'est déjà le jour prévu.');
  if (to < today) add('past', 'block', 'On ne déplace pas une séance dans le passé.');
  const m = movable(s, from, today); if (!m.ok) add('fixed', 'block', m.why!);
  const ev = eventOn(s, to);
  if (ev) add('race-day', 'block', `${label(to)} : ${ev.name}. Le jour d'une compétition, aucune autre séance.`);

  // 2. Jour occupé
  if (!ev && to !== from) {
    if (target.type === 'box') add('busy-box', 'warn', `${label(to)} : ${target.title}. Deux séances le même jour, c'est une charge en plus : choisis plutôt un jour libre.`);
    else if (target.type === 'run' || target.type === 'renfo') {
      if (doneOn(s, to)) add('busy-done', 'warn', `${label(to)} : ${target.title} déjà faite ce jour-là.`);
      else { swapWith = { date: to, title: target.title }; add('busy-swap', 'info', `${label(to)} : ${target.title} est déjà prévue. Les deux séances peuvent être échangées.`); }
    }
  }
  if (issues.some(i => i.severity === 'block')) return finish();

  // 3. Le programme après le déplacement
  const sim = simulate(s, origin, to, swapWith ? to : undefined);
  const moved = planFor(sim, to);
  const intense = hard(moved); const legs = moved.type === 'renfo';

  // Compétitions : 3 jours avant (séance intense) / 2 jours avant (jambes) / lendemain
  for (const e of s.events.filter(x => x.status !== 'annulé' && x.priority !== 'participation' && Math.abs(daysBetween(to, x.date)) <= 3)) {
    const n = daysBetween(to, e.date);
    if (n > 0 && intense) add('race-near', 'warn', `${e.name} dans ${n} jour${n > 1 ? 's' : ''} : une séance d'allure si près de la course entame ta fraîcheur. Version facile conseillée, ou un autre jour.`);
    else if (n > 0 && n <= 2 && legs) add('race-legs', 'warn', `${e.name} dans ${n} jour${n > 1 ? 's' : ''} : renforcement en haut du corps uniquement, ou après la course.`);
    else if (n > 0 && n <= 1 && moved.type === 'run' && moved.run?.kind !== 'affutage') add('race-eve', 'warn', `Veille de ${e.name} : 20 min très faciles maximum. La séance prévue est trop longue pour la veille.`);
    else if (n < 0 && n >= -1) add('race-after', 'warn', `Lendemain de ${e.name} : place à la récupération.`);
    else if (n >= 2 && !intense) add('race-ok', 'info', `${e.name} dans ${n} jours : ${moved.run ? 'footing' : 'séance'} sans intensité, compatible.`);
  }
  // Récupération autour du nouveau jour
  const prev = planFor(sim, addDays(to, -1)), next = planFor(sim, addDays(to, 1));
  if (intense && (hard(prev) || hard(next))) add('back-to-back', 'warn', `Deux séances intenses d'affilée (${hard(prev) ? `${prev.title} la veille` : `${next.title} le lendemain`}) : garde au moins 24 h entre elles.`);
  else if (moved.type === 'run' && !intense && (prev.type === 'box' || next.type === 'box')) add('easy-near-box', 'info', `Footing facile ${next.type === 'box' ? `la veille d'un ${next.title}` : `le lendemain d'un ${prev.title}`} : compatible, à garder vraiment facile.`);
  for (const k of [1, 2]) { const e = eventOn(s, addDays(to, -k)); if (e && !issues.some(i => i.code === 'race-after')) add('post-race', intense ? 'warn' : 'info', `${k === 1 ? 'Lendemain' : 'Deux jours après'} ${e.name} : ${intense ? 'trop tôt pour une séance intense' : 'reste en aisance totale'}.`); }
  // Douleur ou fatigue signalées (check-in du jour visé, ou des deux derniers jours si c'est aujourd'hui)
  const rec = recovery(s, to); const lastCi = [0, 1, 2].map(i => s.checkins[addDays(today, -i)]).find(c => c?.sleep);
  if (rec.level === 'rouge' || rec.level === 'orange') add('fatigue', 'warn', `Check-in ${rec.level} : ${rec.reasons[0]} La séance sera adaptée automatiquement ce jour-là.`);
  else if (to <= addDays(today, 2) && lastCi?.pain === 'oui') add('pain', 'warn', `Douleur signalée récemment (${lastCi.painZone || 'zone non précisée'}). Si elle persiste, préfère une séance plus tard.`);
  // Plafond : 4 jours d'entraînement, un 5e facultatif ; pas plus de 3 jours d'affilée
  const wk = addDays(to, -dow(to)); const days = Array.from({ length: 7 }, (_, i) => planFor(sim, addDays(wk, i)));
  const train = days.filter(TRAIN); const mand = days.filter(p => TRAIN(p) && !p.optional);
  if (mand.length > 5 || train.length > 5) add('cap', 'warn', `${train.length} jours d'entraînement cette semaine : au-delà de ton plafond (4, et un 5e facultatif).`);
  else if (train.length === 5) add('cap5', 'info', '5 jours d\'entraînement cette semaine : le 5e reste facultatif.');
  let run = 0, maxRun = 0; days.forEach(p => { run = TRAIN(p) ? run + 1 : 0; maxRun = Math.max(maxRun, run); });
  if (maxRun >= 4) add('streak', 'warn', `${maxRun} jours d'entraînement d'affilée : prévois un jour de repos au milieu.`);
  const before = Array.from({ length: 7 }, (_, i) => planFor(s, addDays(wk, i)));
  if (before.some(p => p.type === 'rest' && !p.movedTo) && !days.some(p => p.type === 'rest' || p.movedTo)) add('no-rest', 'warn', 'Plus aucun jour de repos dans la semaine.');
  return finish();

  function finish(): MoveCheck {
    const verdict = issues.some(i => i.severity === 'block') ? 'block' : issues.some(i => i.severity === 'warn') ? 'warn' : 'ok';
    const alternatives = verdict === 'ok' || !withAlternatives ? [] : alternativesFor(s, from, today, to);
    const result = verdict === 'block' ? 'Déplacement impossible à cette date.'
      : `${session} : ${fmtDay(from)} → ${fmtDay(to)}${swapWith ? `, et ${swapWith.title} passe au ${fmtDay(from)}` : ''}. Objectif et consignes inchangés${adapted(s, from).reason ? ', adaptation recalculée selon ton check-in du jour' : ''}.`.replace(/\.\./g, '.');
    return { origin, from, to, session, verdict, issues, swapWith, alternatives, result };
  }
}

/** Jours sans conflit, du plus proche au plus lointain, dans les 6 jours autour de la date d'origine. */
export function alternativesFor(s: AppState, from: ISODate, today: ISODate, exclude?: ISODate): { date: ISODate; label: string }[] {
  const out: { date: ISODate; label: string; dist: number }[] = [];
  for (let k = -6; k <= 6; k++) {
    const d = addDays(from, k); if (k === 0 || d === exclude || d < today) continue;
    const p = planFor(s, d); if (p.type !== 'rest' || p.movedTo || eventOn(s, d)) continue;
    const c = checkMove(s, from, d, today, false);
    if (c.verdict === 'ok') out.push({ date: d, label: label(d), dist: Math.abs(k) });
  }
  return out.sort((a, b) => a.dist - b.dist).slice(0, 3).map(({ date, label }) => ({ date, label }));
}

/** Enregistre le déplacement (à appeler dans update()). Échange les deux séances si demandé. Aucune séance n'est supprimée ni recréée. */
export function applyMove(st: AppState, from: ISODate, to: ISODate, swap = false, at = Date.now()) {
  const origin = planFor(st, from).movedFrom || from;
  const other = swap ? (planFor(st, to).movedFrom || to) : null;
  st.reschedule = st.reschedule || { moves: {}, habits: [], habitsAt: 0 };
  st.reschedule = { ...st.reschedule, moves: { ...st.reschedule.moves, [origin]: { to, at } } };
  if (other) st.reschedule.moves[other] = { to: from, at };
}
/** Annule : la séance revient à sa date d'origine (et la séance échangée aussi). */
export function cancelMove(st: AppState, d: ISODate, at = Date.now()) {
  const r = st.reschedule; if (!r) return;
  const origin = planFor(st, d).movedFrom || d; const cur = r.moves[origin]; if (!cur) return;
  const moves = { ...r.moves, [origin]: { to: origin, at } };
  const partner = Object.entries(r.moves).find(([o, x]) => o === cur.to && x.to === origin);
  if (partner) moves[partner[0]] = { to: partner[0], at };
  st.reschedule = { ...r, moves };
}
/** Nouveau jour habituel pour un type de séance, à partir d'une date. Remplace une règle existante pour ce type et ce jour. */
export function setHabit(st: AppState, type: 'run' | 'renfo', fromDow: number, toDow: number, since: ISODate, at = Date.now()) {
  const r = st.reschedule || { moves: {}, habits: [], habitsAt: 0 };
  const habits = r.habits.filter(h => !(h.type === type && h.fromDow === fromDow));
  if (fromDow !== toDow) habits.push({ type, fromDow, toDow, since });
  st.reschedule = { ...r, habits, habitsAt: at };
}
/** Jour habituel modifiable : séance récurrente du programme (pas une séance fixée par le calendrier des courses). */
export function habitFor(s: AppState, d: ISODate): { type: 'run' | 'renfo'; dow: number } | null {
  const origin = planFor(s, d).movedFrom || d; const p = basePlan(s, origin);
  return p.type === 'run' || p.type === 'renfo' ? { type: p.type, dow: dow(origin) } : null;
}
export const _r = { addDays };
