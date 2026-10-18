import { addDays, num, uid } from './dates';
import { upgradeChecks } from './session';
import type { AppState } from './types';

export const DEFAULT_STATE: AppState = {
  v: 3, updatedAt: 0,
  user: {
    name: 'Emily', tz: 'Europe/Paris', height: 165, startDate: '2026-10-14',
    goals: { weightTarget: 60, run: "10 km à 5'30/km, effort maîtrisé", physique: 'Épaules et bras dessinés, dos développé, taille marquée, abdos visibles, fessiers et quadriceps développés' },
    prefs: { checkinTime: '07:00', weighDay: 0, weighTime: '07:30', notifCheckin: true, notifWeigh: true, cycleOptIn: false },
    ref: { k10: null, k5: null },
  },
  program: { id: 'c1', name: 'Cycle 1, octobre à février', start: '2026-10-12', weeks: 20, template: 'cycle1', status: 'active' },
  events: [], activities: [], checkins: {}, measurements: [], strength: {}, runs: {}, overrides: {}, migrated: false,
};

/** Données de départ : jamais écrasées si elles existent déjà. */
export function seed(s: AppState): AppState {
  if (!s.events.length) s.events = [
    { id: 'ev-mudgirl', name: 'MUDGIRL Lyon', type: 'ocr', date: '2026-10-17', place: 'Grand Parc Miribel-Jonage', priority: 'participation', goal: 'Prendre du plaisir, finir entière', status: 'prévu' },
    { id: 'ev-lausanne', name: '10 km de Lausanne', type: 'course', date: '2026-10-25', time: '14:00', distanceKm: 10, place: 'Lausanne', priority: 'repère', goal: 'Premier repère chrono sur 10 km', status: 'prévu' },
    { id: 'ev-athenes', name: "10 km d'Athènes", type: 'course', date: '2026-11-08', time: '08:00', distanceKm: 10, place: 'Athènes, Athens Marathon The Authentic (10 km Road Race)', priority: 'repère', goal: 'Deuxième repère, comparé à Lausanne', status: 'prévu' },
  ];
  if (!s.measurements.some(m => m.date === '2026-10-14')) s.measurements.unshift({ id: 'm-start', date: '2026-10-14', weight: 67.3, fatPct: 32.7, fatKg: 22.0, muscleKg: 42.9, note: 'Point de départ officiel' });
  if (!s.activities.some(a => a.date === '2026-10-14')) s.activities.push({ id: 'a-walk1', date: '2026-10-14', type: 'marche', title: 'Marche', durationMin: 40, source: 'manuel', complementary: false, matched: '2026-10-14', effort: 3 });
  return s;
}

/** Reprend un état venant de l'ancienne app (v1 PWA ou tracker de programme). */
/** Le cycle d'origine reçoit son modèle (calendrier d'octobre à février) ; la liste des programmes existe toujours. */
function upgradePrograms(s: AppState) {
  if (!s.program.template) s.program.template = s.program.id === 'c1' || !s.program.spec ? 'cycle1' : 'custom';
  if (!s.programs) s.programs = [];
}
export function migrate(raw: any): AppState {
  if (raw && raw.v >= 1 && Array.isArray(raw.activities)) { const s = seed({ ...structuredClone(DEFAULT_STATE), ...raw, v: 3 }); upgradeChecks(s); upgradePrograms(s); return s; }
  const s = structuredClone(DEFAULT_STATE);
  if (raw && raw.weeks) {
    const keys = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
    Object.entries<any>(raw.weeks).forEach(([w, wk]) => {
      const base = addDays('2026-10-12', (+w - 1) * 7);
      keys.forEach((k, i) => {
        const date = addDays(base, i);
        if (wk.days?.[k] && !s.activities.some(a => a.date === date)) {
          const type = i === 1 || i === 3 ? 'crossfit' : i === 5 ? 'hyrox' : i === 2 ? 'running' : i === 6 ? 'renfo' : 'marche';
          const title = { crossfit: 'CrossFit', hyrox: 'Cours HYROX', running: 'Running', renfo: 'Renforcement', marche: 'Marche' }[type]!;
          s.activities.push({ id: uid(), date, type: type as any, title, source: 'migration', complementary: type === 'marche', matched: date });
        }
      });
      if (wk.sess) Object.entries<any>(wk.sess).forEach(([sk, ss]) => { const date = addDays(base, sk === 'dim' ? 6 : sk === 'lun' ? 0 : 4); if (ss.ex && Object.keys(ss.ex).length) s.strength[date] = { ex: ss.ex, leg: ss.leg }; });
      if (wk.run && (wk.run.km || wk.run.min)) s.runs[addDays(base, 2)] = wk.run;
      if (num(wk.chk?.weight)) { const date = addDays(base, 6); s.measurements.push({ id: uid(), date, weight: num(wk.chk.weight)!, waist: num(wk.chk.waist), note: 'Moyenne hebdo (ancienne version)' }); }
    });
    if (raw.k5) s.user.ref.k5 = raw.k5;
  }
  s.migrated = true;
  const out = seed(s); upgradeChecks(out); upgradePrograms(out); return out;
}
