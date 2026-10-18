import { adapted, comparable, countsFor, planFor, runsList } from './coach';
import { addDays, dow } from './dates';
const DAYS_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
import { newRecords, recordsUntil } from './records';
import { contribution } from './achievements';
import { sessionProgress } from './session';
import type { Activity, AppState } from './types';

export interface Closure { title: string; stats: string[]; goal: string; facts: string[]; next: string | null; askEffort: boolean; askPain: boolean;
  /** Étapes cochées pendant la séance (« 14 sur 16 séries et étapes »), records du jour, jalons que la séance a fait avancer, adaptation. */
  steps: string | null; records: string[]; contributions: { title: string; text: string; unlocked: boolean }[]; adapted: string | null }
const pace = (a: Activity) => (a.durationMin! * 60) / a.distanceKm!;

/** Écran de fin : uniquement des faits. Une amélioration n'est affichée que si les données la montrent. */
export function buildClosure(s: AppState, a: Activity): Closure {
  const p = planFor(s, a.date); const stats: string[] = []; const facts: string[] = [];
  if (a.durationMin) stats.push(`${Math.round(a.durationMin)} min`);
  if (a.distanceKm) stats.push(`${String(a.distanceKm).replace('.', ',')} km`);
  if (a.distanceKm && a.durationMin) { const sec = pace(a); stats.push(`${Math.floor(sec / 60)}'${String(Math.round(sec % 60)).padStart(2, '0')} /km`); }
  if (a.elevM) stats.push(`${a.elevM} m D+`);
  if (a.calories && a.calories > 0) stats.push(`${Math.round(a.calories)} kcal estimées`);
  const goal = p.run?.goal || p.goal || (a.type === 'crossfit' || a.type === 'hyrox' ? 'Force, puissance et capacité de travail.' : '');
  if (a.type === 'running' && a.distanceKm && a.durationMin) {
    facts.push(p.run?.kind === 'facile' ? `Tu as couru ${Math.round(a.durationMin)} minutes en endurance. Ce type de séance construit ta base aérobie.` : `Séance terminée : ${p.run?.title || a.title}.`);
    const cmp = runsList(s).filter(r => r.id !== a.id && r.date < a.date && r.type === 'running' && comparable(r, a)).slice(-3);
    if (cmp.length >= 3 && a.effort != null && cmp.every(r => r.effort != null)) {
      const d = cmp.reduce((t, r) => t + pace(r), 0) / cmp.length - pace(a); const e = a.effort - cmp.reduce((t, r) => t + (r.effort || 0), 0) / cmp.length;
      if (d > 5 && e <= 0.5) facts.push(`Par rapport à tes 3 dernières sorties comparables, ${Math.round(d)} s/km plus rapide à effort similaire.`);
    }
  } else if (a.type === 'renfo') {
    const before = new Map(recordsUntil(s, addDays(a.date, -1)).map(r => [r.id, r.raw]));
    const now = recordsUntil(s, a.date).filter(r => r.id.startsWith('str-') && r.date === a.date && before.has(r.id) && r.raw > before.get(r.id)!);
    facts.push('Séance de renforcement terminée : épaules, dos, fessiers et abdos ont travaillé.');
    now.forEach(r => facts.push(`Nouvelle meilleure charge en ${r.label.toLowerCase()} : ${r.value}.`));
  } else if (a.type === 'crossfit' || a.type === 'hyrox') facts.push(`${a.title} validé${a.durationMin ? `, ${Math.round(a.durationMin)} min` : ''}.`);
  else facts.push(`${a.title} enregistré.`);
  let next: string | null = null;
  for (let i = 1; i <= 7; i++) { const d = addDays(a.date, i), x = adapted(s, d); if (x.type !== 'rest' && !x.optional) { next = `${(x.replaced || x).title}, ${DAYS_LONG[dow(d)]}`; break; } }
  const c = s.checkins[a.date];
  const sp = sessionProgress(s, a.date, a.date); const ad = adapted(s, a.date);
  const steps = sp.total && sp.done ? `${sp.done} sur ${sp.total} ${sp.items.some(x => x.parent) ? 'séries et étapes' : sp.units.label} cochées` : null;
  const records = newRecords(s, a.date, a.date).filter(r => !(a.type === 'renfo' && r.id.startsWith('str-'))).map(r => `${r.label} : ${r.value}`);
  if (a.effort != null) stats.push(`effort ${a.effort}/10`);
  return { title: a.title, stats, goal, facts, next, askEffort: a.effort == null, askPain: !(c && c.pain), steps, records, contributions: contribution(s, a, a.date).slice(0, 3), adapted: ad.reason && a.date === ad.date && countsFor(a, a.date) ? ad.reason : null };
}
/** Activité qui mérite un écran de fin, pas encore montré. */
export function pendingClosure(s: AppState, from: string, to = '9999-12-31'): Activity | undefined {
  return s.activities.filter(a => !a.complementary && a.date >= from && a.date <= to && countsFor(a, a.date) && !s.closures?.[a.id] && !a.eventId).sort((a, b) => b.date.localeCompare(a.date))[0];
}
