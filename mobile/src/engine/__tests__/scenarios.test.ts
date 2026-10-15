/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adapted, coachLine, doneOn, mandatoryStats, planFor, recordEventResult, recovery, runInsight, zones } from '../coach';
import { DEFAULT_STATE, migrate, seed } from '../state';
import type { AppState } from '../types';

const fresh = (): AppState => seed(structuredClone(DEFAULT_STATE));

test('la marche du 14 octobre est enregistrée et valide le jour', () => {
  const s = fresh(); assert.ok(doneOn(s, '2026-10-14'));
});
test('MUDGIRL remplace le HYROX du samedi 17', () => {
  const p = planFor(fresh(), '2026-10-17'); assert.equal(p.type, 'event'); assert.equal(p.title, 'MUDGIRL Lyon');
});
test('Lausanne le dimanche 25 et Athènes le dimanche 8', () => {
  const s = fresh(); assert.equal(planFor(s, '2026-10-25').title, '10 km de Lausanne'); assert.equal(planFor(s, '2026-11-08').title, "10 km d'Athènes");
  assert.notEqual(planFor(s, '2026-11-07').type, 'event');
});
test('pas de test chronométré dans les deux semaines de courses', () => {
  const s = fresh();
  for (let d = new Date(2026, 9, 18); d <= new Date(2026, 10, 8); d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10); const p = planFor(s, iso); assert.ok(!(p.run && p.run.kind === 'test'), iso);
  }
});
test('veille d\'Athènes : pas de HYROX', () => { const p = planFor(fresh(), '2026-11-07'); assert.equal(p.type, 'run'); assert.equal(p.run?.kind, 'affutage'); });
test('mauvaise nuit + énergie basse = rouge, séance d\'allure remplacée', () => {
  const s = fresh(); s.checkins['2026-12-02'] = { sleep: 'mal', energy: 1, soreness: 'non', pain: 'non', motivation: 3 };
  const a = adapted(s, '2026-12-02'); assert.equal(recovery(s, '2026-12-02').level, 'rouge'); assert.equal(a.replaced?.type, 'recup');
});
test('douleur épaule 3/10 = rouge, variantes épaule', () => {
  const s = fresh(); s.checkins['2026-12-06'] = { sleep: 'bien', energy: 4, soreness: 'non', pain: 'oui', painZone: 'épaule', painLevel: 3, motivation: 4 };
  const r = recovery(s, '2026-12-06'); assert.equal(r.level, 'rouge'); assert.ok(r.shoulder);
});
test('sans check-in, l\'état est inconnu et la séance du plan est gardée', () => {
  const s = fresh(); const a = adapted(s, '2026-12-02'); assert.equal(a.level, 'inconnu'); assert.equal(a.replaced, undefined); assert.match(coachLine(s, '2026-12-02'), /check-in/);
});
test('orange sur une séance de seuil : facile à la place', () => {
  const s = fresh(); s.checkins['2026-12-02'] = { sleep: 'mal', energy: 4, soreness: 'non', pain: 'non', motivation: 4 };
  const a = adapted(s, '2026-12-02'); assert.equal(a.level, 'orange'); assert.equal(a.run?.kind, 'facile');
});
test('HYROX annulé : sortie facile si mercredi était dur', () => {
  const s = fresh(); s.overrides['2026-12-05'] = { noHyrox: true }; const p = planFor(s, '2026-12-05'); assert.equal(p.type, 'run'); assert.equal(p.run?.kind, 'facile');
});
test('promenade avec Sirius : ne valide pas le run du mercredi', () => {
  const s = fresh(); s.activities.push({ id: 'w', date: '2026-12-02', type: 'marche', title: 'Marche avec Sirius', complementary: true, source: 'manuel' });
  assert.equal(doneOn(s, '2026-12-02'), false);
  const st = mandatoryStats(s, '2026-11-30', '2026-12-06'); assert.equal(st.done, 0);
});
test('le résultat de Lausanne devient la référence des allures', () => {
  const s = fresh(); const e = s.events.find(x => x.id === 'ev-lausanne')!; e.result = { time: 62 * 60 + 30 }; recordEventResult(s, e);
  assert.equal(Math.round(zones(s).p10), 375); assert.equal(zones(s).src, 'ton meilleur 10 km');
});
test('course vallonnée plus lente : pas de régression annoncée', () => {
  const s = fresh();
  const mk = (d: string, km: number, min: number, elev: number) => s.activities.push({ id: d, date: d, type: 'running', title: 'Run', distanceKm: km, durationMin: min, elevM: elev, complementary: false, source: 'manuel', kind: 'facile', effort: 4 });
  mk('2026-11-18', 6, 43, 30); mk('2026-11-25', 6, 43.5, 35); mk('2026-12-02', 6.1, 47, 180);
  assert.match(runInsight(s), /pas encore d'équivalent/);
});
test('migration de l\'ancien tracker', () => {
  const s = migrate({ v: 2, weeks: { 1: { days: { jeu: true }, sess: {}, chk: { weight: '67,1' }, run: {} } } });
  assert.ok(doneOn(s, '2026-10-15')); assert.ok(s.measurements.some(m => m.weight === 67.1));
});

import { mergeStrava } from '../strava';
const item = (o: any) => ({ stravaId: o.id, name: o.name || 'x', sportType: o.sport, date: o.date, distanceKm: o.km ?? null, movingMin: o.min ?? null, elapsedMin: o.el ?? o.min ?? null, elevM: o.elev ?? null, avgHr: o.hr ?? null, maxHr: null, updatedAt: 1 });
test('Strava : run du mercredi coché automatiquement', () => {
  const s = fresh(); mergeStrava(s, [item({ id: '1', sport: 'Run', date: '2026-12-02', km: 6.5, min: 44, hr: 150 })]);
  assert.ok(doneOn(s, '2026-12-02'));
});
test('Strava : promenade avec Sirius = complémentaire, ne valide rien', () => {
  const s = fresh(); mergeStrava(s, [item({ id: '2', sport: 'Walk', date: '2026-12-02', km: 3, min: 45 })]);
  assert.equal(doneOn(s, '2026-12-02'), false); assert.equal(s.activities.find(a => a.stravaId === '2')!.complementary, true);
});
test('Strava : CrossFit du mardi sans FC = coché, effort demandé', () => {
  const s = fresh(); mergeStrava(s, [item({ id: '3', sport: 'Crossfit', date: '2026-12-01', min: 58 })]);
  const a = s.activities.find(x => x.stravaId === '3')!; assert.ok(doneOn(s, '2026-12-01')); assert.equal(a.askEffort, true);
});
test('Strava : séance de 15 min le jeudi = confirmation demandée, pas cochée', () => {
  const s = fresh(); mergeStrava(s, [item({ id: '4', sport: 'Workout', date: '2026-12-03', min: 15 })]);
  assert.equal(doneOn(s, '2026-12-03'), false); assert.equal(s.activities.find(x => x.stravaId === '4')!.needsConfirm, true);
});
test('Strava : le 10 km de Lausanne est rattaché à la course', () => {
  const s = fresh(); mergeStrava(s, [item({ id: '5', sport: 'Run', date: '2026-10-25', km: 10.1, min: 61 })]);
  assert.equal(s.activities.find(x => x.stravaId === '5')!.eventId, 'ev-lausanne');
});
test('Strava : activité reçue en retard puis modifiée, pas de doublon', () => {
  const s = fresh(); mergeStrava(s, [item({ id: '6', sport: 'Run', date: '2026-11-25', km: 6, min: 42 })]); mergeStrava(s, [item({ id: '6', sport: 'Run', date: '2026-11-25', km: 6.2, min: 43 })]);
  assert.equal(s.activities.filter(x => x.stravaId === '6').length, 1);
});
test('Strava : remplace la saisie manuelle du même jour', () => {
  const s = fresh(); s.activities.push({ id: 'm', date: '2026-12-01', type: 'crossfit', title: 'CrossFit', source: 'manuel', complementary: false, effort: 7 });
  mergeStrava(s, [item({ id: '7', sport: 'Crossfit', date: '2026-12-01', min: 60 })]);
  assert.equal(s.activities.filter(x => x.date === '2026-12-01' && x.type === 'crossfit').length, 1); assert.equal(s.activities.find(x => x.stravaId === '7')!.effort, 7);
});

import { mergeStates } from '../merge';
test('synchro : une version plus récente ailleurs ne fait pas disparaître le CrossFit coché ici', () => {
  const local = fresh(); local.activities.push({ id: 'cf', date: '2026-10-15', type: 'crossfit', title: 'CrossFit', source: 'manuel', complementary: false, matched: '2026-10-15' }); local.updatedAt = 100;
  const remote = fresh(); remote.measurements.push({ id: 'w2', date: '2026-10-19', weight: 66.9 }); remote.updatedAt = 200;
  const m = mergeStates(local, remote);
  assert.ok(doneOn(m, '2026-10-15')); assert.ok(m.measurements.some(x => x.id === 'w2'));
});

import { planReminders } from '../reminders';
test('rappels : check-in quotidien à l\'heure choisie, rien si déjà fait', () => {
  const s = fresh(); const now = new Date(2026, 10, 3, 6, 0);
  const r = planReminders(s, now, 3); assert.equal(r.filter(x => x.kind !== 'weigh').length, 3); assert.equal(r[0].at.getHours(), 7);
  s.checkins['2026-11-03'] = { sleep: 'bien', energy: 4, soreness: 'non', pain: 'non', motivation: 4 };
  assert.ok(!planReminders(s, now, 3).some(x => x.id.endsWith('2026-11-03')));
});
test('rappels : pesée le lundi fusionnée avec le check-in, absente si déjà pesée', () => {
  const s = fresh(); const now = new Date(2026, 10, 8, 20, 0); // dimanche soir
  const r = planReminders(s, now, 2); const mon = r.find(x => x.id.endsWith('2026-11-09'))!;
  assert.equal(mon.kind, 'both'); assert.equal(mon.url, '/checkin?then=measure');
  s.measurements.push({ id: 'x', date: '2026-11-09', weight: 66 });
  assert.equal(planReminders(s, now, 2).find(x => x.id.endsWith('2026-11-09'))!.kind, 'checkin');
});
test('rappels : désactivés = aucun rappel', () => {
  const s = fresh(); s.user.prefs.notifCheckin = false; s.user.prefs.notifWeigh = false;
  assert.equal(planReminders(s, new Date(2026, 10, 3, 6, 0)).length, 0);
});
