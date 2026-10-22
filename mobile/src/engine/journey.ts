import { adapted, comparable, countsFor, deloadOf, mandatoryStats, phasesOf, runsList, trend, weekOf, weekStart, weightSeries } from './coach';
import { achievementsFor, programWindow } from './achievements';
import { addDays, fmtShort, mmss, num } from './dates';
import { newRecords, recordsUntil } from './records';
import type { AppState, ISODate } from './types';

export type StepStatus = 'à venir' | 'en cours' | 'atteinte' | 'réévaluée';
export interface Step { id: string; title: string; criterion: string; status: StepStatus; progress: string | null; ratio: number | null; history: string[]; next: string }

const pace = (a: { durationMin?: number | null; distanceKm?: number | null }) => (a.durationMin! * 60) / a.distanceKm!;
/** Semaines du cycle terminées, avec réussite selon la règle du bilan (semaine allégée incluse). */
export function weekSuccess(s: AppState, today: ISODate) {
  const out: { w: number; ok: boolean; easyRuns: number }[] = []; const cur = weekOf(s, today);
  for (let w = 1; w < Math.min(cur, s.program.weeks + 1); w++) {
    let planned = 0, done = 0, easy = 0;
    for (let i = 0; i < 7; i++) { const d = addDays(weekStart(s, w), i), a = adapted(s, d); const v = s.activities.filter(x => x.date === d && countsFor(x, d));
      if (a.mandatory && !a.skipped) { planned++; if (v.length) done++; }
      easy += v.filter(x => x.type === 'running' && (x.kind || 'facile') === 'facile').length; }
    out.push({ w, ok: planned > 0 && done / planned >= (deloadOf(s).includes(w) ? 0.6 : 0.75), easyRuns: easy });
  }
  return out;
}
const maxStreak = (xs: boolean[]) => { let m = 0, c = 0; xs.forEach(x => { c = x ? c + 1 : 0; m = Math.max(m, c); }); return m; };
const currentStreak = (xs: boolean[]) => { let c = 0; for (let i = xs.length - 1; i >= 0 && xs[i]; i--) c++; return c; };

function sequence(steps: Omit<Step, 'status'>[], achieved: (Date | ISODate | null)[]): Step[] {
  let foundCurrent = false;
  return steps.map((st, i) => {
    const done = achieved[i]; if (done) return { ...st, status: 'atteinte' as StepStatus };
    if (!foundCurrent) { foundCurrent = true; return { ...st, status: 'en cours' as StepStatus }; }
    return { ...st, status: 'à venir' as StepStatus };
  });
}

export function runningJourney(s0: AppState, today: ISODate): Step[] {
  // Même règle et même compteur que l'accomplissement « Footing régulier » : un seul calcul.
  const reg = achievementsFor(s0, today).find(a => a.id === 'run-regular')!;
  const s = programWindow(s0, today); // étapes du programme : uniquement ce qui a été fait pendant ce programme
  const ws = weekSuccess(s, today); const easyWeeks = ws.map(w => w.easyRuns >= 1);
  const runs = runsList(s).filter(r => r.type === 'running');
  const easy = runs.filter(r => (r.kind || 'facile') === 'facile' && (r.effort == null || r.effort <= 5));
  const best45 = easy.reduce((m, r) => Math.max(m, r.durationMin || 0), 0); const r45 = easy.find(r => (r.durationMin || 0) >= 45);
  const lastEasy = easy[easy.length - 1]; const cmp = lastEasy ? easy.filter(r => r.id !== lastEasy.id && comparable(r, lastEasy)) : [];
  let improved: ISODate | null = null;
  if (lastEasy && cmp.length >= 2) { const avg = cmp.reduce((t, r) => t + pace(r), 0) / cmp.length; if (avg - pace(lastEasy) > 5) improved = lastEasy.date; }
  const refs = [...s.events.filter(e => e.result && e.distanceKm && e.distanceKm >= 9.9 && e.distanceKm <= 10.3).map(e => ({ d: e.date, p: e.result!.time / e.distanceKm!, n: e.name })),
    ...runs.filter(r => r.kind === 'test').map(r => ({ d: r.date, p: pace(r), n: 'test' }))].sort((a, b) => a.d.localeCompare(b.d));
  const firstRef = refs[0]; const better = refs.find((r, i) => i > 0 && r.p < firstRef.p - 1);
  const best10 = recordsUntil(s, today).find(r => r.id === 'run-10k');
  const steps: Omit<Step, 'status'>[] = [
    { id: 'r1', title: 'Endurance facile régulière', criterion: 'Au moins un footing facile par semaine, 4 semaines d\'affilée.', progress: reg.progress!.label, ratio: reg.progress!.value / reg.progress!.target, history: reg.date ? [`Atteint le ${fmtShort(reg.date)}`] : [], next: 'Ton footing du mercredi, en vraie aisance respiratoire.' },
    { id: 'r2', title: '45 minutes à effort confortable', criterion: 'Une sortie facile d\'au moins 45 min, effort ressenti 5/10 ou moins.', progress: best45 ? `Plus longue sortie facile : ${Math.round(best45)} min` : null, ratio: best45 ? Math.min(1, best45 / 45) : null, history: r45 ? [`Atteint le ${fmtShort(r45.date)}`] : [], next: 'Allonge de 5 min une sortie facile, sans accélérer.' },
    { id: 'r3', title: 'Allure qui s\'améliore à effort égal', criterion: 'Ta dernière sortie facile plus rapide de plus de 5 s/km que la moyenne de tes sorties comparables (même distance, même dénivelé).', progress: lastEasy ? `${Math.min(cmp.length, 2)} sortie${cmp.length > 1 ? 's' : ''} comparable${cmp.length > 1 ? 's' : ''} sur 2 nécessaires` : null, ratio: lastEasy ? Math.min(1, cmp.length / 2) : null, history: improved ? [`Constaté le ${fmtShort(improved)}`] : [], next: 'Refais tes footings sur un même parcours pour pouvoir comparer.' },
    { id: 'r4', title: 'Premier repère 10 km', criterion: 'Un 10 km chronométré (course ou test).', progress: firstRef ? `${mmss(firstRef.p)} /km` : null, ratio: firstRef ? 1 : null, history: firstRef ? [`${firstRef.n === 'test' ? 'Test' : firstRef.n}, ${fmtShort(firstRef.d)}`] : [], next: 'Le 10 km de Lausanne, le 25 octobre.' },
    { id: 'r5', title: 'Améliorer ton chrono de référence', criterion: 'Un 10 km plus rapide que ton premier repère.', progress: firstRef && refs.length > 1 ? `Meilleur : ${mmss(Math.min(...refs.map(r => r.p)))} /km` : null, ratio: null, history: better ? [`${better.n === 'test' ? 'Test' : better.n}, ${fmtShort(better.d)}, ${mmss(better.p)} /km`] : [], next: 'Athènes, le 8 novembre, puis les tests de fin de phase.' },
    { id: 'r6', title: '10 km à 5\'30/km', criterion: 'Un 10 km en 55:00 ou moins, effort maîtrisé.', progress: best10 ? `Écart actuel : ${mmss(Math.max(0, best10.raw / 10 - 330))} /km` : null, ratio: null, history: best10 && best10.raw <= 3300 ? [`Atteint le ${fmtShort(best10.date)}`] : [], next: 'Objectif à moyen terme : on le rapproche palier par palier.' },
  ];
  return sequence(steps, [reg.date, r45?.date || null, improved, firstRef?.d || null, better?.d || null, best10 && best10.raw <= 3300 ? best10.date : null]);
}

export function bodyJourney(s0: AppState, today: ISODate): Step[] {
  const s = programWindow(s0, today);
  const ws = weekSuccess(s, today); const okWeeks = ws.map(w => w.ok);
  const main = ['f1', 'm1', 'm2', 'm3'];
  const sessions = Object.keys(s.strength).filter(d => d <= today).sort();
  const lifts = main.map(id => sessions.map(d => Math.max(0, ...(s.strength[d].ex?.[id]?.kg || []).map(num).filter((n): n is number => !!n))).filter(v => v > 0));
  const maintained = lifts.filter(v => v.length >= 2 && v[v.length - 1] >= 0.95 * Math.max(...v)).length;
  const progressed = lifts.filter(v => v.length >= 2 && Math.max(...v.slice(1)) > v[0]).length;
  const ms = weightSeries(s).filter(m => m.date >= addDays(today, -28)); const all = weightSeries(s); const tr = trend(all);
  const goal = s.user.goals.weightTarget; const lastTrend = tr.length ? tr[tr.length - 1] : null;
  const steps: Omit<Step, 'status'>[] = [
    { id: 'p1', title: 'Régularité soutenable', criterion: '4 semaines d\'affilée avec au moins 75 % des séances prévues (semaine allégée : 60 %).', progress: ws.length ? `${Math.min(4, currentStreak(okWeeks))} semaine${currentStreak(okWeeks) > 1 ? 's' : ''} sur 4` : null, ratio: ws.length ? Math.min(1, currentStreak(okWeeks) / 4) : null, history: maxStreak(okWeeks) >= 4 ? ['4 semaines régulières atteintes'] : [], next: 'Tes séances fixes de la semaine. L\'optionnel reste optionnel.' },
    { id: 'p2', title: 'Charges principales maintenues', criterion: 'Hip thrust, landmine, tirage et rowing à 95 % ou plus de ton meilleur, sur au moins 2 séances chacun.', progress: sessions.length ? `${maintained} exercice${maintained > 1 ? 's' : ''} sur 4` : null, ratio: sessions.length ? maintained / 4 : null, history: [], next: 'Note tes charges à chaque renforcement du dimanche.' },
    { id: 'p3', title: 'Progression en renforcement', criterion: 'Une charge supérieure à ta première séance sur au moins 2 exercices principaux.', progress: sessions.length >= 2 ? `${progressed} exercice${progressed > 1 ? 's' : ''} sur 2` : null, ratio: sessions.length >= 2 ? Math.min(1, progressed / 2) : null, history: [], next: 'Suis la charge suggérée quand tu atteins le haut de la fourchette.' },
    { id: 'p4', title: 'Suivi de composition régulier', criterion: 'Au moins 4 pesées sur les 4 dernières semaines.', progress: `${ms.length} pesée${ms.length > 1 ? 's' : ''} sur 4`, ratio: Math.min(1, ms.length / 4), history: [], next: 'La pesée du lundi matin, dans les mêmes conditions.' },
    { id: 'p5', title: `Tendance vers ${String(goal).replace('.', ',')} kg`, criterion: `Tendance lissée du poids à ${String(goal).replace('.', ',')} kg ou moins (cible souhaitée, pas une garantie).`, progress: lastTrend != null && all.length >= 4 ? `Tendance actuelle : ${lastTrend.toFixed(1).replace('.', ',')} kg` : null, ratio: null, history: [], next: 'Rien à forcer : la régularité de l\'entraînement fait le travail.' },
  ];
  return sequence(steps, [maxStreak(okWeeks) >= 4 ? today : null, maintained === 4 ? today : null, progressed >= 2 ? today : null, ms.length >= 4 ? today : null, lastTrend != null && all.length >= 4 && lastTrend <= goal ? today : null]);
}

/* Les paliers (accomplissements) sont dans achievements.ts : un seul système. */

/* ---------- Chapitres du parcours : les phases réelles du programme ---------- */
export type ChapterState = 'terminé' | 'en cours' | 'à venir';
export interface Chapter {
  n: string; name: string; goal: string; from: number; to: number; state: ChapterState;
  /** Une case par semaine : réussie, non réussie, en cours ou à venir. */ weeks: { w: number; state: 'ok' | 'ko' | 'current' | 'next' }[];
  milestone: { id: string; title: string; reached: ISODate | null; progress: string | null };
  next: string; bilan: { done: number; planned: number; km: number; records: number } | null;
}
export function chapters(s: AppState, today: ISODate, ach = achievementsFor(s, today)): Chapter[] {
  const cur = weekOf(s, today); const ws = weekSuccess(s, today);
  return phasesOf(s.program).map(ph => {
    const end = addDays(weekStart(s, ph.to), 6); const state: ChapterState = end < today ? 'terminé' : cur >= ph.from ? 'en cours' : 'à venir';
    const weeks = Array.from({ length: ph.to - ph.from + 1 }, (_, i) => { const w = ph.from + i; const r = ws.find(x => x.w === w); return { w, state: (r ? (r.ok ? 'ok' : 'ko') : w === cur ? 'current' : 'next') as Chapter['weeks'][number]['state'] }; });
    const m = ach.find(a => a.id === ph.milestone);
    let bilan: Chapter['bilan'] = null;
    if (state !== 'à venir') {
      const from = weekStart(s, ph.from), to = state === 'terminé' ? end : today; const st = mandatoryStats(s, from, to);
      const km = s.activities.filter(a => a.date >= from && a.date <= to && (a.type === 'running' || a.type === 'course') && !a.complementary).reduce((t, a) => t + (a.distanceKm || 0), 0);
      bilan = { done: st.done, planned: st.planned, km: Math.round(km * 10) / 10, records: newRecords(s, from, to).length };
    }
    const next = state === 'terminé' ? 'Chapitre bouclé.' : state === 'à venir' ? `Commence semaine ${ph.from}, le ${fmtShort(weekStart(s, ph.from))}.` : m?.date ? 'Jalon du chapitre atteint : garde la régularité jusqu\'au bout.' : (m ? `Vise le jalon « ${m.title.toLowerCase()} »${m.progress ? ` (${m.progress.label.charAt(0).toLowerCase()}${m.progress.label.slice(1)})` : ''}.` : 'Tes séances prévues de la semaine.');
    return { n: ph.n, name: ph.name, goal: ph.goal, from: ph.from, to: ph.to, state, weeks, milestone: { id: ph.milestone, title: m?.title || '', reached: m?.date || null, progress: m?.progress?.label || null }, next, bilan };
  });
}
