import { addDays } from './dates';
import type { Activity, AppState, ISODate } from './types';

/** Catégories pour comprendre d'où vient la dépense, sans mélanger entraînements et promenades. */
export type EnergyCat = 'entraînement' | 'complémentaire' | 'promenade' | 'récupération';
export const categoryOf = (a: Activity): EnergyCat =>
  a.type === 'marche' ? (a.complementary ? 'promenade' : 'récupération') : a.complementary || !a.matched ? 'complémentaire' : 'entraînement';

export interface EnergySummary { total: number; withData: number; count: number; pending: number; byCat: Record<EnergyCat, { kcal: number; n: number }>; byType: Record<string, number> }
/** Dépense estimée des activités sur une période. Le total ne couvre que les activités qui ont une valeur : jamais présenté comme exhaustif. */
export function energy(s: AppState, from: ISODate, to: ISODate): EnergySummary {
  const acts = s.activities.filter(a => a.date >= from && a.date <= to && !(a.type === 'course' && s.activities.some(b => b.id !== a.id && b.stravaId && b.eventId === a.eventId && a.source !== 'strava')));
  const byCat: EnergySummary['byCat'] = { entraînement: { kcal: 0, n: 0 }, complémentaire: { kcal: 0, n: 0 }, promenade: { kcal: 0, n: 0 }, récupération: { kcal: 0, n: 0 } };
  const byType: Record<string, number> = {}; let total = 0, withData = 0, pending = 0;
  for (const a of acts) {
    if (a.calories && a.calories > 0) { total += a.calories; withData++; const k = categoryOf(a); byCat[k].kcal += a.calories; byCat[k].n++; byType[a.type] = (byType[a.type] || 0) + a.calories; }
    else if (a.source === 'strava' && (a.caloriesStatus === 'pending' || a.caloriesStatus === undefined)) pending++;
  }
  return { total: Math.round(total), withData, count: acts.length, pending, byCat, byType };
}
export const weekRange = (start: ISODate) => [start, addDays(start, 6)] as const;
/** Libellé de couverture : « 4 activités sur 5 avec données énergétiques ». */
export const coverage = (e: EnergySummary) => (e.withData === e.count ? `${e.count} activité${e.count > 1 ? 's' : ''}` : `${e.withData} activité${e.withData > 1 ? 's' : ''} sur ${e.count} avec données énergétiques`);
