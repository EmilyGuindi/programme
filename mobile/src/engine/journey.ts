import { adapted, comparable, countsFor, DELOAD, runsList, trend, weekOf, weekStart, weightSeries } from './coach';
import { addDays, fmtShort, mmss, num } from './dates';
import { recordsUntil } from './records';
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
    out.push({ w, ok: planned > 0 && done / planned >= (DELOAD.includes(w) ? 0.6 : 0.75), easyRuns: easy });
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

export function runningJourney(s: AppState, today: ISODate): Step[] {
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
    { id: 'r1', title: 'Endurance facile régulière', criterion: 'Au moins un footing facile par semaine, 4 semaines d\'affilée.', progress: `${Math.min(4, currentStreak(easyWeeks))} semaine${currentStreak(easyWeeks) > 1 ? 's' : ''} sur 4`, ratio: Math.min(1, currentStreak(easyWeeks) / 4), history: maxStreak(easyWeeks) >= 4 ? ['4 semaines régulières atteintes'] : [], next: 'Ton footing du mercredi, en vraie aisance respiratoire.' },
    { id: 'r2', title: '45 minutes à effort confortable', criterion: 'Une sortie facile d\'au moins 45 min, effort ressenti 5/10 ou moins.', progress: best45 ? `Plus longue sortie facile : ${Math.round(best45)} min` : null, ratio: best45 ? Math.min(1, best45 / 45) : null, history: r45 ? [`Atteint le ${fmtShort(r45.date)}`] : [], next: 'Allonge de 5 min une sortie facile, sans accélérer.' },
    { id: 'r3', title: 'Allure qui s\'améliore à effort égal', criterion: 'Ta dernière sortie facile plus rapide de plus de 5 s/km que la moyenne de tes sorties comparables (même distance, même dénivelé).', progress: lastEasy ? `${Math.min(cmp.length, 2)} sortie${cmp.length > 1 ? 's' : ''} comparable${cmp.length > 1 ? 's' : ''} sur 2 nécessaires` : null, ratio: lastEasy ? Math.min(1, cmp.length / 2) : null, history: improved ? [`Constaté le ${fmtShort(improved)}`] : [], next: 'Refais tes footings sur un même parcours pour pouvoir comparer.' },
    { id: 'r4', title: 'Premier repère 10 km', criterion: 'Un 10 km chronométré (course ou test).', progress: firstRef ? `${mmss(firstRef.p)} /km` : null, ratio: firstRef ? 1 : null, history: firstRef ? [`${firstRef.n === 'test' ? 'Test' : firstRef.n} · ${fmtShort(firstRef.d)}`] : [], next: 'Le 10 km de Lausanne, le 25 octobre.' },
    { id: 'r5', title: 'Améliorer ton chrono de référence', criterion: 'Un 10 km plus rapide que ton premier repère.', progress: firstRef && refs.length > 1 ? `Meilleur : ${mmss(Math.min(...refs.map(r => r.p)))} /km` : null, ratio: null, history: better ? [`${better.n === 'test' ? 'Test' : better.n} · ${fmtShort(better.d)} · ${mmss(better.p)} /km`] : [], next: 'Athènes, le 8 novembre, puis les tests de fin de phase.' },
    { id: 'r6', title: '10 km à 5\'30/km', criterion: 'Un 10 km en 55:00 ou moins, effort maîtrisé.', progress: best10 ? `Écart actuel : ${mmss(Math.max(0, best10.raw / 10 - 330))} /km` : null, ratio: null, history: best10 && best10.raw <= 3300 ? [`Atteint le ${fmtShort(best10.date)}`] : [], next: 'Objectif à moyen terme : on le rapproche palier par palier.' },
  ];
  return sequence(steps, [maxStreak(easyWeeks) >= 4 ? today : null, r45?.date || null, improved, firstRef?.d || null, better?.d || null, best10 && best10.raw <= 3300 ? best10.date : null]);
}

export function bodyJourney(s: AppState, today: ISODate): Step[] {
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

export interface Achievement { id: string; title: string; detail: string; date: ISODate | null }
export function achievements(s: AppState, today: ISODate): Achievement[] {
  const ws = weekSuccess(s, today); const ok = ws.map(w => w.ok);
  const firstRace = s.events.filter(e => e.result || e.status === 'fait').sort((a, b) => a.date.localeCompare(b.date))[0];
  const nWeeks = ok.filter(Boolean).length; const ci = Object.keys(s.checkins).filter(k => s.checkins[k].sleep).sort();
  const runs = runsList(s); const r45 = runs.find(r => (r.durationMin || 0) >= 45);
  const lastWeek = ws.find(w => w.w === s.program.weeks);
  return [
    { id: 'a-race', title: 'Première compétition', detail: 'Terminer une course ou un événement enregistré.', date: firstRace?.date || null },
    { id: 'a-4w', title: '4 semaines régulières', detail: '4 semaines réussies d\'affilée. Une semaine allégée bien suivie compte.', date: maxStreak(ok) >= 4 ? today : null },
    { id: 'a-10w', title: '10 semaines réussies', detail: 'Pas forcément d\'affilée : la régularité se mesure sur la durée.', date: nWeeks >= 10 ? today : null },
    { id: 'a-ci', title: '20 check-ins', detail: 'Ton coach connaît de mieux en mieux ta récupération.', date: ci.length >= 20 ? ci[19] : null },
    { id: 'a-45', title: 'Première sortie de 45 min', detail: 'Une course d\'au moins 45 minutes.', date: r45?.date || null },
    { id: 'a-cycle', title: 'Premier cycle terminé', detail: '20 semaines, du 14 octobre au 28 février.', date: lastWeek ? today : null },
  ];
}
