/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adapted, doneOn, planFor } from '../coach';
import { mergeStates } from '../merge';
import { nextEvent } from '../race';
import { isOn, sessionProgress, setCheck, toggleCheck } from '../session';
import { DEFAULT_STATE, migrate, seed } from '../state';
import { dayStatus, eventState, weekSummary } from '../status';
import { mergeStrava } from '../strava';
import type { AppState, StravaItem } from '../types';

const fresh = (): AppState => seed(structuredClone(DEFAULT_STATE));
/** Ce que fait l'app à la fermeture puis à la réouverture : sérialisation sur le disque, relecture, migration. */
const reload = (s: AppState) => migrate(JSON.parse(JSON.stringify(s)));
const SUN = '2026-11-15'; // renforcement court, semaine 5
const T0 = '2026-11-15';

/* ---------- Persistance des coches ---------- */
test('une coche survit à la fermeture et à la réouverture de l\'app', () => {
  const s = fresh(); setCheck(s, SUN, 'set:f1:1', true);
  const r = reload(reload(s));
  assert.ok(isOn(r, SUN, 'set:f1:1'));
});
test('une coche peut être retirée, et le décochage persiste', () => {
  const s = fresh(); toggleCheck(s, SUN, 'set:f1:1'); toggleCheck(s, SUN, 'set:f1:1');
  const r = reload(s); assert.equal(isOn(r, SUN, 'set:f1:1'), false); assert.equal(r.checks![SUN]['set:f1:1'].on, false);
});
test('les coches de mobilité (récupération active) sont mémorisées', () => {
  const s = fresh(); setCheck(s, '2026-10-18', 'mob:chat-vache', true);
  const p = sessionProgress(reload(s), '2026-10-18', '2026-10-18');
  assert.equal(p.done, 1); assert.equal(p.total, 7); assert.equal(p.state, 'en-cours');
});
test('cocher ne termine pas la séance : en cours, puis partielle si le jour est passé', () => {
  const s = fresh(); setCheck(s, SUN, 'warm:rameur', true); setCheck(s, SUN, 'set:f1:1', true);
  assert.equal(doneOn(s, SUN), false);
  assert.equal(sessionProgress(s, SUN, T0).state, 'en-cours');
  assert.equal(sessionProgress(s, SUN, '2026-11-16').state, 'partielle');
  assert.equal(dayStatus(s, adapted(s, SUN), '2026-11-16'), 'partial');
  assert.equal(dayStatus(s, adapted(s, SUN), T0), 'inProgress');
});
test('états : non commencée, terminée, terminée avec adaptation', () => {
  const s = fresh(); assert.equal(sessionProgress(s, SUN, T0).state, 'non-commencee');
  s.activities.push({ id: 'r1', date: SUN, type: 'renfo', title: 'Renforcement', source: 'manuel', matched: SUN, complementary: false });
  assert.equal(sessionProgress(s, SUN, T0).state, 'terminee');
  s.overrides[SUN] = { level: 'orange' };
  assert.equal(sessionProgress(s, SUN, T0).state, 'terminee-adaptee');
});
test('progression réelle : séries et exercices complets', () => {
  const s = fresh(); const p0 = sessionProgress(s, SUN, T0);
  const f1 = p0.items.filter(x => x.parent === 'f1');
  f1.forEach(x => setCheck(s, SUN, x.id, true));
  const p = sessionProgress(s, SUN, T0);
  assert.equal(p.done, f1.length); assert.equal(p.units.done, 1);
  assert.equal(p.current?.id, 'warm:rameur'); // l'échauffement n'est pas fait : c'est l'étape actuelle
});
test('modifier la séance (version réduite) garde les séries déjà cochées', () => {
  const s = fresh(); setCheck(s, SUN, 'set:f1:1', true);
  s.overrides[SUN] = { level: 'orange' };
  assert.ok(isOn(s, SUN, 'set:f1:1'));
  assert.ok(sessionProgress(s, SUN, T0).items.some(x => x.id === 'set:f1:1'));
});
test('migration : les anciennes séries cochées (index) deviennent des coches stables', () => {
  const raw = { ...fresh(), v: 2, checks: undefined, strength: { [SUN]: { ex: { f1: { kg: ['40'], reps: ['8'], done: [true, false] } }, warm: { 0: true } } }, runs: { '2026-10-21': { steps: { 0: true } } } };
  const s = migrate(raw);
  assert.ok(isOn(s, SUN, 'set:f1:1')); assert.equal(isOn(s, SUN, 'set:f1:2'), false);
  assert.ok(isOn(s, SUN, 'warm:rameur')); assert.ok(isOn(s, '2026-10-21', 'step:facile:1'));
  assert.equal(s.strength[SUN].ex.f1.kg[0], '40', 'aucune donnée historique perdue');
});

/* ---------- Synchronisation ---------- */
test('hors ligne puis retour en ligne : les coches des deux appareils sont fusionnées, la plus récente gagne', () => {
  const phone = fresh(), server = fresh();
  setCheck(phone, SUN, 'set:f1:1', true, 200);
  setCheck(server, SUN, 'set:m2:1', true, 100);
  setCheck(server, SUN, 'set:f1:2', true, 100); setCheck(phone, SUN, 'set:f1:2', false, 300); // décochée plus tard sur le téléphone
  const m = mergeStates(phone, server);
  assert.ok(isOn(m, SUN, 'set:f1:1')); assert.ok(isOn(m, SUN, 'set:m2:1')); assert.equal(isOn(m, SUN, 'set:f1:2'), false);
  const m2 = mergeStates(server, phone); // même résultat dans l'autre sens
  assert.deepEqual(m2.checks, m.checks);
});
test('fusion du journal de renforcement : charges des deux côtés conservées', () => {
  const a = fresh(), b = fresh();
  a.strength[SUN] = { ex: { f1: { kg: ['40', null], reps: ['8', null], done: [] } } };
  b.strength[SUN] = { ex: { f1: { kg: [null, '42.5'], reps: [null, '7'], done: [] }, m2: { kg: ['30'], reps: ['10'], done: [] } } };
  const m = mergeStates(a, b);
  assert.deepEqual(m.strength[SUN].ex.f1.kg, ['40', '42.5']); assert.equal(m.strength[SUN].ex.m2.kg[0], '30');
});
test('une activité supprimée ne réapparaît pas après synchronisation', () => {
  const phone = fresh(), server = fresh();
  const act = { id: 'x1', date: '2026-10-20', type: 'crossfit' as const, title: 'CrossFit', source: 'manuel' as const, complementary: false, matched: '2026-10-20' };
  server.activities.push({ ...act });
  phone.deleted = { x1: 500 };
  assert.ok(!mergeStates(phone, server).activities.some(a => a.id === 'x1'));
  assert.ok(!mergeStates(server, phone).activities.some(a => a.id === 'x1'));
});
const wt = (date: string, id = '9'): StravaItem => ({ stravaId: id, name: 'Renfo', sportType: 'WeightTraining', date, distanceKm: null, movingMin: 40, elapsedMin: 42, elevM: null, avgHr: 110, maxHr: 140, updatedAt: 1, calories: 210, caloriesChecked: true });
test('un import Strava ne réinitialise jamais les coches, et garde séparément le détail des exercices', () => {
  const s = fresh(); setCheck(s, SUN, 'set:f1:1', true); setCheck(s, SUN, 'set:f1:2', true);
  mergeStrava(s, [wt(SUN)]);
  assert.ok(doneOn(s, SUN), 'Strava valide la séance');
  assert.ok(isOn(s, SUN, 'set:f1:1') && isOn(s, SUN, 'set:f1:2'), 'les coches manuelles restent');
});
test('pas de doublon : la séance terminée dans l\'app puis importée de Strava reste une seule activité, sans second écran de fin', () => {
  const s = fresh();
  s.activities.push({ id: 'renfo-x', date: SUN, type: 'renfo', title: 'Renforcement', source: 'manuel', matched: SUN, complementary: false });
  s.closures = { 'renfo-x': 1 };
  mergeStrava(s, [wt(SUN)]); mergeStrava(s, [wt(SUN)]);
  const acts = s.activities.filter(a => a.date === SUN && a.type === 'renfo');
  assert.equal(acts.length, 1); assert.ok(s.closures![acts[0].id], 'écran de fin déjà vu');
});
test('une activité Strava supprimée dans l\'app ne revient pas au prochain import', () => {
  const s = fresh(); s.deleted = { 'strava-9': 1 }; mergeStrava(s, [wt(SUN)]);
  assert.ok(!s.activities.some(a => a.stravaId === '9'));
});

/* ---------- Statuts et durées ---------- */
test('récupération active : 40 min partout (30 de marche + 10 de mobilité)', () => {
  const s = fresh(); assert.equal(planFor(s, '2026-10-18').dur, '40 min');
  s.checkins['2026-12-02'] = { sleep: 'mal', energy: 1, soreness: 'non', pain: 'non', motivation: 3 };
  assert.equal(adapted(s, '2026-12-02').replaced?.dur, '40 min');
  assert.match(adapted(s, '2026-12-02').replaced!.goal, /30 min.*10 min/);
});
test('récupération active validée : elle compte pour le jour (ce n\'est pas une promenade complémentaire)', () => {
  const s = fresh();
  s.activities.push({ id: 'rec', date: '2026-10-18', type: 'marche', title: 'Récupération active', durationMin: 40, source: 'manuel', complementary: false, matched: '2026-10-18' });
  assert.ok(doneOn(s, '2026-10-18'));
});
test('compétition passée sans données : « à confirmer », jamais « en préparation »', () => {
  const s = fresh(); const ev = s.events.find(e => e.id === 'ev-mudgirl')!;
  assert.equal(eventState(s, ev, '2026-10-18'), 'toConfirm');
  assert.equal(dayStatus(s, adapted(s, '2026-10-17'), '2026-10-18'), 'raceToConfirm');
  assert.equal(eventState(s, ev, '2026-10-17'), 'today');
});
test('compétition importée de Strava : terminée partout, et plus proposée comme prochaine course', () => {
  const s = fresh();
  mergeStrava(s, [{ stravaId: '77', name: '10 km Lausanne', sportType: 'Run', date: '2026-10-25', distanceKm: 10.1, movingMin: 61, elapsedMin: 62, elevM: 40, avgHr: 170, maxHr: 185, updatedAt: 1 }]);
  const ev = s.events.find(e => e.id === 'ev-lausanne')!;
  assert.equal(eventState(s, ev, '2026-10-25'), 'done');
  assert.equal(dayStatus(s, adapted(s, '2026-10-25'), '2026-10-25'), 'raceDone');
  assert.notEqual(nextEvent(s, '2026-10-25')?.id, 'ev-lausanne');
});
test('une optionnelle faite est comptée à part : elle ne devient pas une séance due', () => {
  const s = fresh(); const ws = '2026-11-09';
  const before = weekSummary(s, ws, '2026-11-16');
  s.activities.push({ id: 'o', date: SUN, type: 'renfo', title: 'Renforcement', source: 'manuel', matched: SUN, complementary: false });
  const after = weekSummary(s, ws, '2026-11-16');
  assert.equal(after.planned, before.planned); assert.equal(after.done, before.done); assert.equal(after.optionalDone, 1);
});
test('optionnelle non faite et repos : aucune pénalité', () => {
  const s = fresh(); const w = weekSummary(s, '2026-11-09', '2026-11-16');
  assert.equal(w.optionalDone, 0); assert.ok(w.rests >= 1);
  assert.equal(w.missed, w.planned - w.done, 'seules les séances prévues manquées comptent');
});
