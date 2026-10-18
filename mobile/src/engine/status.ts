import { adapted, doneOn } from './coach';
import { addDays } from './dates';
import { sessionProgress } from './session';
import type { AdaptedPlan, AppState, ISODate, SportEvent } from './types';

/* ============================================================
   Statuts BYYND — une seule source pour Aujourd'hui, Programme, Progression, détail de séance, bilans et records.
   ============================================================ */

export type EventState = 'cancelled' | 'upcoming' | 'today' | 'done' | 'toConfirm';
/** État d'une compétition. Terminée dès qu'il y a un résultat, une activité rattachée ou un statut « fait ».
 *  Date passée sans aucune donnée : « à confirmer » (jamais « en préparation »). */
export function eventState(s: AppState, ev: SportEvent, today: ISODate): EventState {
  if (ev.status === 'annulé') return 'cancelled';
  if (ev.result || ev.status === 'fait' || s.activities.some(a => a.eventId === ev.id)) return 'done';
  if (ev.date < today) return 'toConfirm';
  return ev.date === today ? 'today' : 'upcoming';
}
export const eventDone = (s: AppState, ev: SportEvent, today: ISODate) => eventState(s, ev, today) === 'done';

export type Status = 'planned' | 'done' | 'adapted' | 'optional' | 'rest' | 'race' | 'raceDone' | 'raceToConfirm' | 'missed' | 'pending' | 'synced' | 'inProgress' | 'partial' | 'none';
export const STATUS_LABEL: Record<Status, string> = { planned: 'prévu', done: 'fait', adapted: 'adapté', optional: 'optionnel', rest: 'repos', race: 'compétition', raceDone: 'compétition terminée', raceToConfirm: 'résultat à confirmer', missed: 'non fait', pending: 'à confirmer', synced: 'synchronisé', inProgress: 'en cours', partial: 'partiellement réalisée', none: '' };

/** Une activité Strava « à confirmer » ne reste pas indéfiniment en attente : au-delà de 7 jours, elle n'est plus proposée. */
export const CONFIRM_WINDOW = 7;

/** Statut d'un jour, identique partout. */
export function dayStatus(s: AppState, a: AdaptedPlan, today: ISODate): Status {
  if (a.date < s.user.startDate) return 'none';
  if (a.type === 'event' && a.event) {
    const st = eventState(s, a.event, today);
    if (st === 'done') return 'raceDone';
    if (st === 'toConfirm') return 'raceToConfirm';
    if (st !== 'cancelled') return 'race';
  }
  const acts = s.activities.filter(x => x.date === a.date && !x.complementary);
  if (doneOn(s, a.date)) return acts.some(x => x.source === 'strava') ? 'synced' : 'done';
  if (acts.some(x => x.needsConfirm) && a.date >= addDays(today, -CONFIRM_WINDOW)) return 'pending';
  if (a.type === 'rest' || a.type === 'event') return 'rest';
  const sp = sessionProgress(s, a.date, today);
  if (sp.done > 0) return a.date < today ? 'partial' : 'inProgress';
  if (a.date < today && a.mandatory && !a.skipped) return 'missed';
  if (a.optional) return 'optional';
  if (a.reason || a.replaced) return 'adapted';
  return 'planned';
}

export interface WeekSummary { planned: number; done: number; adapted: number; remaining: number; missed: number; rests: number; optionalDone: number; optionalOpen: number; races: number; racesDone: number; racesToConfirm: number; text: string }
/** La semaine en un coup d'œil : séances prévues réalisées (le seul ratio), adaptées, restantes, repos, optionnelles faites, compétitions.
 *  Une optionnelle faite est comptée à part : elle ne devient jamais une séance « due ». Un repos n'est jamais une absence. */
export function weekSummary(s: AppState, start: ISODate, today: ISODate): WeekSummary {
  const out = { planned: 0, done: 0, adapted: 0, remaining: 0, missed: 0, rests: 0, optionalDone: 0, optionalOpen: 0, races: 0, racesDone: 0, racesToConfirm: 0 };
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i); if (d < s.user.startDate) continue;
    const a = adapted(s, d); const ok = doneOn(s, d);
    if (a.type === 'event' && a.event) { out.races++; const es = eventState(s, a.event, today); if (es === 'done') out.racesDone++; else if (es === 'toConfirm') out.racesToConfirm++; continue; }
    if (a.type === 'rest') { out.rests++; continue; }
    if (a.mandatory && !a.skipped) { out.planned++; if (ok) { out.done++; if (a.reason || a.replaced) out.adapted++; } else if (d >= today) out.remaining++; else out.missed++; }
    else if (a.optional) { if (ok) out.optionalDone++; else if (d >= today) out.optionalOpen++; }
  }
  const pl = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
  const parts = [out.planned ? `${out.done}/${out.planned} prévues` : '', out.adapted ? pl(out.adapted, 'adaptée', 'adaptées') : '', out.remaining ? pl(out.remaining, 'à venir', 'à venir') : '',
    out.optionalDone ? `+${pl(out.optionalDone, 'optionnelle', 'optionnelles')}` : '', out.races ? (out.racesDone ? pl(out.racesDone, 'course terminée', 'courses terminées') : out.racesToConfirm ? pl(out.racesToConfirm, 'course à confirmer', 'courses à confirmer') : pl(out.races, 'course', 'courses')) : ''];
  return { ...out, text: parts.filter(Boolean).join(' · ') };
}
