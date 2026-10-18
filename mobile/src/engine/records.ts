import { addDays } from './dates';
import { EX } from './library';
import { num } from './dates';
import { isOnKey } from './session';
import type { Activity, AppState, ISODate } from './types';

export interface Record_ { id: string; label: string; value: string; raw: number; date: ISODate; better: 'lower' | 'higher' }
const plausibleRun = (a: Activity) => !!(a.distanceKm && a.durationMin) && (a.durationMin! * 60) / a.distanceKm! >= 180 && (a.durationMin! * 60) / a.distanceKm! <= 720;
const fmtTime = (sec: number) => { sec = Math.round(sec); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return h ? `${h}h${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; };

/** Records calculés jusqu'à une date (incluse). Les vitesses ne viennent que de courses ou tests sur la bonne distance, avec une allure plausible. */
export function recordsUntil(s: AppState, until: ISODate): Record_[] {
  const out: Record_[] = [];
  const runs = s.activities.filter(a => (a.type === 'running' || a.type === 'course') && a.date <= until && !a.complementary && plausibleRun(a));
  const timed = (lo: number, hi: number) => {
    const ev = s.events.filter(e => e.result && e.date <= until && e.distanceKm && e.distanceKm >= lo && e.distanceKm <= hi).map(e => ({ t: e.result!.time * (lo + hi) / 2 / e.distanceKm!, date: e.date }));
    const tests = runs.filter(a => (a.kind === 'test' || a.type === 'course') && a.distanceKm! >= lo && a.distanceKm! <= hi).map(a => ({ t: a.durationMin! * 60 * ((lo + hi) / 2) / a.distanceKm!, date: a.date }));
    return [...ev, ...tests].sort((a, b) => a.t - b.t)[0];
  };
  const b10 = timed(9.9, 10.3); if (b10) out.push({ id: 'run-10k', label: 'Meilleur 10 km', value: fmtTime(b10.t), raw: b10.t, date: b10.date, better: 'lower' });
  const b5 = timed(4.95, 5.2); if (b5) out.push({ id: 'run-5k', label: 'Meilleur 5 km', value: fmtTime(b5.t), raw: b5.t, date: b5.date, better: 'lower' });
  const longest = [...runs].sort((a, b) => b.distanceKm! - a.distanceKm!)[0];
  if (longest) out.push({ id: 'run-longest', label: 'Plus longue sortie', value: `${String(Math.round(longest.distanceKm! * 10) / 10).replace('.', ',')} km`, raw: longest.distanceKm!, date: longest.date, better: 'higher' });
  const longestT = [...runs].sort((a, b) => b.durationMin! - a.durationMin!)[0];
  if (longestT) out.push({ id: 'run-duration', label: 'Plus longue durée de course', value: `${Math.round(longestT.durationMin!)} min`, raw: longestT.durationMin!, date: longestT.date, better: 'higher' });
  for (const id of ['f1', 'f2', 'f3', 'm1', 'm2', 'm3', 'm4']) {
    let best: { kg: number; date: ISODate } | null = null;
    for (const [d, l] of Object.entries(s.strength)) { if (d > until) continue; const e = l.ex?.[id]; if (!e) continue; e.kg.forEach((k, i) => { const v = num(k); if (v && v > 0 && v < 400 && (e.done[i] || isOnKey(s, d, `set:${id}:${i + 1}`) || num(e.reps[i])) && (!best || v > best.kg)) best = { kg: v, date: d }; }); }
    if (best) out.push({ id: 'str-' + id, label: EX[id].name.split(',')[0], value: `${String((best as any).kg).replace('.', ',')} kg`, raw: (best as any).kg, date: (best as any).date, better: 'higher' });
  }
  return out;
}
/** Records battus pendant une période : comparés aux meilleurs d'avant. Un premier enregistrement n'est pas un « record battu ». */
export function newRecords(s: AppState, from: ISODate, to: ISODate): Record_[] {
  const before = new Map(recordsUntil(s, addDays(from, -1)).map(r => [r.id, r]));
  return recordsUntil(s, to).filter(r => r.date >= from && r.date <= to && before.has(r.id) && (r.better === 'lower' ? r.raw < before.get(r.id)!.raw : r.raw > before.get(r.id)!.raw));
}
