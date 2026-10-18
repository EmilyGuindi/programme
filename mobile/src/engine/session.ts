import { adapted, doneOn, strengthBlocks } from './coach';
import { MOBILITY, RUN_COOLDOWN, RUN_WARMUP } from './guides';
import { WARMUP } from './library';
import type { AdaptedPlan, AppState, ISODate, Mark } from './types';

/* ============================================================
   Séance en cours : éléments cochables, progression réelle, état.
   Source de vérité unique : AppState.checks[date][id] = { on, at }.
   Identifiants stables :
     renforcement  warm:<id> (échauffement) · set:<exercice>:<n° de série>
     running       step:<type de séance>:<n° d'étape> · rwarm:<id> · rcool:<id> (guides, hors progression)
     récupération  mob:<id>
   ============================================================ */

export type SessionState = 'non-commencee' | 'en-cours' | 'partielle' | 'terminee' | 'terminee-adaptee';
export const SESSION_LABEL: Record<SessionState, string> = { 'non-commencee': 'Non commencée', 'en-cours': 'En cours', partielle: 'Partiellement réalisée', terminee: 'Terminée', 'terminee-adaptee': 'Terminée, adaptée' };

export interface SessionItem { id: string; label: string; group: string; /** Exercice parent (séries d'un même exercice). */ parent?: string }
export interface SessionProgress {
  items: SessionItem[]; done: number; total: number; ratio: number;
  /** Exercices entièrement faits / total (renforcement : toutes les séries cochées). */ units: { done: number; total: number; label: string };
  current: SessionItem | null; next: SessionItem | null; state: SessionState; adapted: boolean; allChecked: boolean;
}

export const isOn = (s: AppState, d: ISODate, id: string) => !!s.checks?.[d]?.[id]?.on;

/** Coche ou décoche (à appeler dans update()). Horodatée pour la fusion entre appareils. */
export function setCheck(st: AppState, d: ISODate, id: string, on: boolean, at = Date.now()) {
  st.checks = st.checks || {};
  const day = (st.checks[d] = st.checks[d] || {});
  day[id] = { on, at: Math.max(at, (day[id]?.at || 0) + 1) };
  // Ancien stockage des séries : tenu cohérent pour les versions précédentes de l'app.
  const m = /^set:(\w+):(\d+)$/.exec(id);
  const e = m && st.strength[d]?.ex?.[m[1]];
  if (e) e.done[+m[2] - 1] = on;
}
export const toggleCheck = (st: AppState, d: ISODate, id: string) => setCheck(st, d, id, !isOn(st, d, id));

/** Mode du renforcement selon l'adaptation du jour : normal, réduit, supprimé. */
export function strengthMode(s: AppState, d: ISODate, a = adapted(s, d)): 'n' | 'r' | 'x' {
  const lv = s.overrides[d]?.level || a.level;
  return lv === 'rouge' ? 'x' : lv === 'orange' ? 'r' : 'n';
}

/** Éléments qui comptent dans la progression de la séance prévue ce jour-là. */
export function sessionItems(s: AppState, d: ISODate, a: AdaptedPlan = adapted(s, d)): { items: SessionItem[]; unit: string } {
  const shown = a.replaced || a;
  if (shown.type === 'recup') return { items: MOBILITY.map(m => ({ id: `mob:${m.id}`, label: m.name, group: 'Récupération' })), unit: 'exercices' };
  if (a.type === 'run' && a.run && !a.replaced) return { items: a.run.steps.map((st, i) => ({ id: `step:${a.run!.kind}:${i + 1}`, label: st.text, group: 'Déroulé' })), unit: 'étapes' };
  if (a.type === 'renfo') {
    const mode = strengthMode(s, d, a); if (mode === 'x') return { items: [], unit: 'exercices' };
    const items: SessionItem[] = WARMUP.map(w => ({ id: `warm:${w.id}`, label: w.text, group: 'Échauffement' }));
    strengthBlocks(s, d, mode === 'r').forEach(b => b.items.forEach(e => { for (let n = 1; n <= e.nSets; n++) items.push({ id: `set:${e.id}:${n}`, label: `${e.name} · série ${n}/${e.nSets}`, group: b.title, parent: e.id }); }));
    return { items, unit: 'exercices' };
  }
  return { items: [], unit: '' };
}

export function sessionProgress(s: AppState, d: ISODate, today: ISODate): SessionProgress {
  const a = adapted(s, d); const { items, unit } = sessionItems(s, d, a);
  const on = (x: SessionItem) => isOn(s, d, x.id);
  const done = items.filter(on).length; const total = items.length;
  // Unités : un exercice (toutes ses séries) ou une étape. L'échauffement compte pour une unité.
  const unitOf = (x: SessionItem) => x.parent || (x.group === 'Échauffement' ? 'warm' : x.id);
  const groups = new Map<string, SessionItem[]>();
  items.forEach(x => groups.set(unitOf(x), [...(groups.get(unitOf(x)) || []), x]));
  const unitsDone = [...groups.values()].filter(g => g.every(on)).length;
  const firstOpen = items.findIndex(x => !on(x));
  const current = firstOpen >= 0 ? items[firstOpen] : null;
  const next = current ? items.find((x, i) => i > firstOpen && !on(x) && unitOf(x) !== unitOf(current)) || null : null;
  const finished = doneOn(s, d);
  const adaptedFlag = !!(a.reason || a.replaced || (a.type === 'renfo' && strengthMode(s, d, a) !== 'n'));
  const state: SessionState = finished ? (adaptedFlag ? 'terminee-adaptee' : 'terminee') : done === 0 ? 'non-commencee' : d < today ? 'partielle' : 'en-cours';
  return { items, done, total, ratio: total ? done / total : 0, units: { done: unitsDone, total: groups.size, label: unit }, current, next, state, adapted: adaptedFlag, allChecked: total > 0 && done === total };
}

/** Guides du running (échauffement, retour au calme) : cochables et mémorisés, sans compter dans la progression. */
export const guideId = (prefix: 'rwarm' | 'rcool' | 'mob', moveId: string) => `${prefix}:${moveId}`;
export const RUN_GUIDES = { rwarm: RUN_WARMUP, rcool: RUN_COOLDOWN } as const;

/** Reprise des anciennes coches (index de séries, d'échauffement, d'étapes) dans `checks`, sans rien écraser. Idempotente. */
export function upgradeChecks(s: AppState) {
  const add = (d: ISODate, id: string) => { s.checks = s.checks || {}; const day = (s.checks[d] = s.checks[d] || {}); if (!day[id]) day[id] = { on: true, at: 1 } as Mark; };
  for (const [d, l] of Object.entries(s.strength || {})) {
    for (const [ex, e] of Object.entries(l.ex || {})) (e.done || []).forEach((v, i) => { if (v) add(d, `set:${ex}:${i + 1}`); });
    for (const [i, v] of Object.entries(l.warm || {})) if (v && WARMUP[+i]) add(d, `warm:${WARMUP[+i].id}`);
  }
  for (const [d, r] of Object.entries(s.runs || {})) {
    if (!r.steps) continue;
    const kind = adapted(s, d).run?.kind || 'facile';
    for (const [i, v] of Object.entries(r.steps)) if (v) add(d, `step:${kind}:${+i + 1}`);
  }
}
