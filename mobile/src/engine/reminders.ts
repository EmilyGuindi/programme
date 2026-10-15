import { addDays, dow, iso } from './dates';
import type { AppState } from './types';

export interface Reminder { id: string; at: Date; title: string; body: string; url: string; kind: 'checkin' | 'weigh' | 'both' }

const at = (dateIso: string, hhmm: string) => { const [h, m] = (hhmm || '07:00').split(':').map(n => +n || 0); const [y, mo, d] = dateIso.split('-').map(Number); return new Date(y, mo - 1, d, h, m, 0, 0); };
const weekStartOf = (d: string) => addDays(d, -dow(d));
export const weighedThisWeek = (s: AppState, d: string) => { const ws = weekStartOf(d); return s.measurements.some(m => m.date >= ws && m.date <= addDays(ws, 6)); };
export const checkedIn = (s: AppState, d: string) => { const c = s.checkins[d]; return !!(c && c.sleep && c.energy && c.soreness && c.pain && c.motivation); };

/** Rappels des 14 prochains jours, sans doublon : pas de check-in déjà fait, pas de pesée déjà faite, un seul message si les deux tombent ensemble. */
export function planReminders(s: AppState, now = new Date(), days = 14): Reminder[] {
  const p = s.user.prefs; const out: Reminder[] = []; const today = iso(now);
  for (let i = 0; i < days; i++) {
    const d = addDays(today, i);
    const ci = p.notifCheckin && !checkedIn(s, d) ? at(d, p.checkinTime) : null;
    const wg = p.notifWeigh && dow(d) === p.weighDay && !weighedThisWeek(s, d) ? at(d, p.weighTime) : null;
    const valid = (x: Date | null) => x && x.getTime() > now.getTime() + 30_000;
    const c = valid(ci) ? ci : null, w = valid(wg) ? wg : null;
    if (c && w && Math.abs(c.getTime() - w.getTime()) <= 60 * 60_000) {
      out.push({ id: `both-${d}`, at: c < w ? c : w, kind: 'both', title: 'Check-in et pesée du jour', body: 'Comment tu te sens ? Ensuite, ton bilan hebdo en 20 secondes.', url: '/checkin?then=measure' });
      continue;
    }
    if (c) out.push({ id: `checkin-${d}`, at: c, kind: 'checkin', title: 'Comment tu te sens ce matin ?', body: 'Ton coach adapte ta journée. 30 secondes.', url: '/checkin' });
    if (w) out.push({ id: `weigh-${d}`, at: w, kind: 'weigh', title: "C'est l'heure de ton bilan hebdo", body: 'On fait le point sur ta progression ?', url: '/measure' });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}
