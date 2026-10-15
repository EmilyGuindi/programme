import { adapted, planFor } from './coach';
import type { Activity, ActivityType, AppState, StravaItem } from './types';

const RUN = ['Run', 'TrailRun', 'VirtualRun'];
const WALK = ['Walk', 'Hike'];
const BOX = ['Crossfit', 'Workout', 'HighIntensityIntervalTraining', 'WeightTraining'];
const minutesOf = (dur?: string) => { const m = /(\d+)/.exec(dur || ''); return m ? +m[1] : null; };

/** Décide du type BYYND et de la correspondance avec la séance prévue. Une sortie différente reste dans l'historique sans être cochée. */
export function classify(s: AppState, it: StravaItem): Pick<Activity, 'type' | 'title' | 'complementary' | 'matched' | 'needsConfirm' | 'kind' | 'eventId' | 'askEffort'> {
  const p = planFor(s, it.date); const a = adapted(s, it.date);
  const dur = it.elapsedMin ?? it.movingMin ?? 0;
  const ev = p.type === 'event' ? p.event : undefined;
  if (WALK.includes(it.sportType)) {
    const planned = p.type === 'recup' || (a.replaced?.type === 'recup');
    return { type: 'marche', title: it.name || 'Marche', complementary: !planned, matched: planned ? it.date : null, needsConfirm: false };
  }
  if (ev) {
    const fits = ev.type === 'course' ? RUN.includes(it.sportType) && (!ev.distanceKm || Math.abs((it.distanceKm || 0) - ev.distanceKm) <= ev.distanceKm * 0.15) : RUN.includes(it.sportType) || BOX.includes(it.sportType);
    if (fits) return { type: ev.type === 'course' ? 'course' : 'autre', title: ev.name, complementary: false, matched: it.date, needsConfirm: false, kind: 'test', eventId: ev.id };
  }
  if (RUN.includes(it.sportType)) {
    const plannedRun = (a.replaced ? null : a.run) || p.run;
    if (plannedRun && p.type === 'run') {
      const target = minutesOf(plannedRun.dur);
      const ok = !target || (it.movingMin ?? 0) >= target * 0.6;
      const kind = plannedRun.kind === 'qualite' ? 'qualite' : plannedRun.kind === 'test' ? 'test' : 'facile';
      return { type: 'running', title: plannedRun.title, complementary: false, matched: ok ? it.date : null, needsConfirm: !ok, kind };
    }
    return { type: 'running', title: it.name || 'Running', complementary: false, matched: null, needsConfirm: false, kind: 'facile' };
  }
  if (BOX.includes(it.sportType)) {
    const noHr = !it.avgHr;
    if (p.type === 'box') {
      const ok = dur >= 35 && dur <= 100;
      return { type: p.hyrox ? 'hyrox' : 'crossfit', title: p.hyrox ? 'Cours HYROX' : 'CrossFit', complementary: false, matched: ok ? it.date : null, needsConfirm: !ok, askEffort: noHr };
    }
    if (p.type === 'renfo' && it.sportType === 'WeightTraining') return { type: 'renfo', title: 'Renforcement', complementary: false, matched: it.date, needsConfirm: false };
    return { type: (it.sportType === 'WeightTraining' ? 'renfo' : 'crossfit') as ActivityType, title: it.name || 'Séance', complementary: false, matched: null, needsConfirm: true, askEffort: noHr };
  }
  return { type: 'autre', title: it.name || it.sportType, complementary: true, matched: null, needsConfirm: false };
}

/** Fusionne les activités Strava dans l'état, sans écraser les corrections faites dans l'app. */
export function mergeStrava(s: AppState, items: StravaItem[]) {
  for (const it of items) {
    const i = s.activities.findIndex(a => a.stravaId === it.stravaId);
    if (it.deleted) { if (i >= 0 && !s.activities[i].userEdited) s.activities.splice(i, 1); continue; }
    const metrics = { date: it.date, durationMin: it.movingMin, elapsedMin: it.elapsedMin, distanceKm: it.distanceKm, elevM: it.elevM, avgHr: it.avgHr, maxHr: it.maxHr, sportType: it.sportType, startLocal: it.startLocal, laps: it.laps, effort: it.perceived ?? undefined };
    if (i >= 0) {
      const cur = s.activities[i];
      Object.assign(cur, metrics, { effort: cur.effort ?? it.perceived ?? null });
      if (!cur.userEdited) Object.assign(cur, classify(s, it));
    } else {
      // une saisie manuelle du même jour et du même type est remplacée par la version Strava (pas de doublon)
      const c = classify(s, it);
      const dup = s.activities.findIndex(a => a.source === 'manuel' && a.date === it.date && a.type === c.type && !a.eventId);
      const base: Activity = { id: 'strava-' + it.stravaId, stravaId: it.stravaId, source: 'strava', ...metrics, ...c, effort: it.perceived ?? (dup >= 0 ? s.activities[dup].effort : null) } as Activity;
      if (dup >= 0) { base.notes = s.activities[dup].notes; s.activities.splice(dup, 1); }
      s.activities.push(base);
    }
  }
}
