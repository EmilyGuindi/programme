import { addDays, daysBetween, dow } from './dates';
import { RECUP, RUN } from './library';
import type { ISODate, ProgramDef, ProgramPhase, ProgramSpec, RunFocus, RunSession, Slot, SportEvent } from './types';

/* ============================================================
   Générateur de programmes personnalisés. Entrée : une description (ProgramSpec), jamais du code ni un calendrier libre.
   Les règles de progression et de sécurité sont celles de BYYND : ce module ne lit aucune instruction textuelle.
   ============================================================ */

export const SLOT_LABEL: Record<Slot, string> = { crossfit: 'CrossFit', hyrox: 'HYROX', run: 'Running qualité', long: 'Sortie longue', renfo: 'Renforcement', recup: 'Récupération', rest: 'Repos' };
export const FOCUS_LABEL: Record<RunFocus, string> = { '10k': 'Progresser sur 10 km', '5k': 'Progresser sur 5 km', endurance: 'Courir plus longtemps', maintien: 'Garder la forme' };
/** Le calendrier d'origine, décrit comme une semaine type (pour comparer et pour préremplir le suivant). */
export const CYCLE1_SPEC: ProgramSpec = { days: ['rest', 'crossfit', 'run', 'crossfit', 'rest', 'hyrox', 'renfo'], focus: '10k', deloadEvery: 0, tests: true };
export const HARD: Slot[] = ['crossfit', 'hyrox', 'run'];

/** Découpage en phases selon la durée et l'objectif. Toujours au moins une phase ; la dernière semaine sert de bilan dès 6 semaines. */
export function generatePhases(weeks: number, focus: RunFocus): ProgramPhase[] {
  const bilan = weeks >= 6 ? 1 : 0; const body = weeks - bilan;
  const spec = focus === 'maintien' || focus === 'endurance' ? 0 : Math.max(1, Math.round(body * 0.25));
  const base = Math.max(1, Math.round(body * (focus === 'endurance' ? 0.5 : 0.4))); const dev = Math.max(0, body - base - spec);
  const out: ProgramPhase[] = []; let w = 1; const L = 'ABCDE';
  const push = (len: number, kind: ProgramPhase['kind'], name: string, goal: string, milestone: string) => { if (len <= 0) return; out.push({ n: L[out.length], name, from: w, to: w + len - 1, goal, milestone, kind }); w += len; };
  push(base, 'base', 'Base', 'Reprendre le rythme et installer le volume facile.', 'run-45');
  push(dev, 'dev', focus === 'endurance' ? 'Volume' : 'Développement', focus === 'endurance' ? 'Allonger la sortie longue, sans forcer l\'allure.' : 'Tenir plus longtemps une allure soutenue.', 'run-endurance');
  push(spec, 'spec', focus === '5k' ? 'Spécifique 5 km' : 'Spécifique 10 km', 'Rapprocher l\'allure de course de l\'objectif.', focus === '5k' ? 'run-pr-5k' : 'run-pr-10k');
  push(bilan, 'bilan', 'Bilan', 'Mesurer le chemin parcouru et préparer la suite.', 'reg-cycle');
  return out;
}
export const programEnd = (p: ProgramDef): ISODate => p.end || addDays(p.start, p.weeks * 7 - 1);
export const phasesFor = (p: ProgramDef): ProgramPhase[] => p.phases?.length ? p.phases : generatePhases(p.weeks, p.spec?.focus || 'maintien');
export function deloadWeeks(p: ProgramDef): number[] {
  if (p.template !== 'custom') return [12];
  const every = p.spec?.deloadEvery || 0; if (!every) return [];
  const ph = phasesFor(p); const last = ph.find(x => x.kind === 'bilan')?.from ?? p.weeks + 1;
  const out: number[] = []; for (let w = every; w < last - 1; w += every) out.push(w); return out;
}

/** Séance de course clé de la semaine. Progression : volume facile d'abord, intensité ensuite, jamais les deux à la fois. */
export function keyRun(p: ProgramDef, w: number): RunSession {
  const ph = phasesFor(p).find(x => w >= x.from && w <= x.to) || phasesFor(p)[0]; const k = w - ph.from; const focus = p.spec?.focus || 'maintien';
  if (deloadWeeks(p).includes(w)) return RUN.easy(40);
  if (ph.kind === 'bilan') return p.spec?.tests === false ? RUN.easy(40) : focus === '5k' ? RUN.test5() : RUN.test10();
  if (p.spec?.tests !== false && w === 2) return RUN.test5(); // repère de départ
  if (ph.kind === 'base' || focus === 'endurance' || focus === 'maintien') return RUN.easy(Math.min(55, 40 + 5 * Math.floor(k / 2)), 4 + Math.min(2, k)); // +5 min toutes les deux semaines : la sortie longue progresse déjà
  if (ph.kind === 'dev') return [RUN.seuil(3, 6, 2), RUN.seuil(4, 6, 1.5), RUN.seuil(3, 8, 2), RUN.seuil(4, 8, 2), RUN.seuil(3, 10, 2)][Math.min(4, k)];
  if (focus === '5k') return [RUN.seuil(6, 3, 1.5), RUN.seuil(5, 4, 2), RUN.seuil(8, 2, 1)][Math.min(2, k)];
  return [RUN.k10('3 × 8 min', 46), RUN.k10('4 × 1 km', 48), RUN.k10('3 × 2 km', 55), RUN.k10('5 × 1 km', 52)][Math.min(3, k)];
}
/** Sortie longue : +5 min toutes les deux semaines, plafonnée, courte en semaine allégée ou de bilan. */
export function longRun(p: ProgramDef, w: number): RunSession {
  const cap = p.spec?.focus === 'endurance' ? 90 : 70;
  const n = Array.from({ length: w - 1 }, (_, i) => i + 1).filter(x => !deloadWeeks(p).includes(x)).length;
  const bilan = phasesFor(p).find(x => x.kind === 'bilan');
  if (deloadWeeks(p).includes(w) || (bilan && w >= bilan.from)) return RUN.easy(40); // semaine allégée ou de test : sortie courte
  return RUN.easy(Math.min(cap, 50 + 5 * Math.floor(n / 2)));
}

type DayPlan = { type: 'box' | 'run' | 'renfo' | 'rest' | 'recup'; title: string; dur?: string; goal?: string; note?: string; run?: RunSession; hyrox?: boolean; optional?: boolean; short?: boolean };
/** Un jour d'un programme personnalisé (hors compétition, gérée par le calendrier commun). Ajuste autour des compétitions. */
export function customDay(p: ProgramDef, d: ISODate, events: SportEvent[], noHyrox = false): DayPlan {
  const w = Math.floor(daysBetween(p.start, d) / 7) + 1; const slot = (p.spec?.days || CYCLE1_SPEC.days)[dow(d)] || 'rest';
  const live = events.filter(e => e.status !== 'annulé');
  const before = live.find(e => e.date === addDays(d, 1)); const after = live.find(e => e.date === addDays(d, -1));
  const raceWeek = live.find(e => daysBetween(d, e.date) > 0 && daysBetween(d, e.date) <= 6 && e.type === 'course');
  const compWeek = live.find(e => daysBetween(d, e.date) > 0 && daysBetween(d, e.date) <= 6 && (e.type === 'crossfit-compet' || e.type === 'hyrox-compet'));
  const deload = deloadWeeks(p).includes(w);
  if (after && slot !== 'rest') return { type: 'recup', title: RECUP.title, dur: RECUP.dur, goal: `${RECUP.goal} Lendemain de ${after.name}.` };
  switch (slot) {
    case 'crossfit': return { type: 'box', title: before ? 'CrossFit léger' : 'CrossFit', note: before ? `Effort ≤ 7/10 : ${before.name} demain.` : compWeek ? `Semaine de compétition (${compWeek.name}) : technique et intensité courte, pas de séance lourde.` : deload ? 'Semaine allégée : garde 2 reps en réserve.' : undefined };
    case 'hyrox':
      if (noHyrox) { const r = RUN.easy(45, 4); return { type: 'run', title: r.title, dur: r.dur, goal: r.goal, run: r, note: 'Remplace le cours HYROX' }; }
      return { type: 'box', title: 'Cours HYROX', hyrox: true, note: before || raceWeek ? 'Effort libre, pas à fond : une course approche.' : undefined };
    case 'run': { const r = before ? RUN.sharp() : raceWeek && raceWeek.priority !== 'participation' ? RUN.rappel() : keyRun(p, w); return { type: 'run', title: r.title, dur: r.dur, goal: r.goal, run: r }; }
    case 'long': { const r = before || raceWeek ? RUN.easy(35) : longRun(p, w); return { type: 'run', title: r.title, dur: r.dur, goal: r.goal, run: r, note: raceWeek ? 'Raccourcie : course dans la semaine.' : undefined }; }
    case 'renfo': return { type: 'renfo', title: deload || before ? 'Renforcement, version courte' : 'Renforcement full body', dur: deload || before ? '25–30 min' : '35–45 min', goal: 'Épaules, dos, fessiers, abdos. Optionnel : fatiguée, tu le supprimes.', short: deload || !!before, note: deload ? 'Semaine allégée' : undefined };
    case 'recup': return { type: 'recup', title: RECUP.title, dur: RECUP.dur, goal: RECUP.goal };
    default: return { type: 'rest', title: 'Repos', goal: before ? `Repos avant ${before.name}.` : 'Repos complet. Une marche est bienvenue.' };
  }
}
/** Minutes de course prévues sur une semaine (contrôle de la progression du volume). */
export function weeklyRunMinutes(p: ProgramDef, w: number): number {
  let t = 0; (p.spec?.days || []).forEach((sl, i) => { if (sl === 'run' || sl === 'long') { const r = sl === 'run' ? keyRun(p, w) : longRun(p, w); t += parseInt(r.dur, 10) || 0; } void i; });
  return t;
}
