/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { achievementsFor, contribution, nextMilestone, toCelebrate } from '../achievements';
import { adapted, weekStart } from '../coach';
import { addDays } from '../dates';
import { energy, coverage } from '../energy';
import { chapters, weekSuccess } from '../journey';
import { buildRecap } from '../recap';
import { DEFAULT_STATE, seed } from '../state';
import { mergeStrava } from '../strava';
import type { Activity, AppState, StravaItem } from '../types';

const fresh = (): AppState => seed(structuredClone(DEFAULT_STATE));
const get = (s: AppState, id: string, today = '2027-03-10') => achievementsFor(s, today).find(a => a.id === id)!;
const run = (id: string, date: string, km: number, min: number, extra: Partial<Activity> = {}): Activity => ({ id, date, type: 'running', title: 'Run', distanceKm: km, durationMin: min, complementary: false, source: 'manuel', matched: date, kind: 'facile', effort: 4, ...extra });
/** Valide toutes les séances prévues (obligatoires) d'une semaine du cycle. */
function fillWeek(s: AppState, w: number, ratio = 1) {
  const days = Array.from({ length: 7 }, (_, i) => adapted(s, addDays(weekStart(s, w), i))).filter(a => a.mandatory && !a.skipped && a.type !== 'event');
  days.slice(0, Math.round(days.length * ratio)).forEach(a => s.activities.push({ id: `w${w}-${a.date}`, date: a.date, type: a.type === 'run' ? 'running' : 'crossfit', title: a.title, source: 'manuel', matched: a.date, complementary: false, durationMin: 50 }));
}

test('identifiants uniques, chaque accomplissement porte titre, description, critère, état, source', () => {
  const xs = achievementsFor(fresh(), '2026-10-20');
  assert.equal(new Set(xs.map(a => a.id)).size, xs.length);
  for (const a of xs) { assert.ok(a.title && a.description && a.criterion && a.source && a.status); assert.ok(['running', 'force', 'competition', 'regularite', 'recuperation'].includes(a.cat)); }
});
test('aucun accomplissement sans données', () => {
  assert.equal(achievementsFor(fresh(), '2026-10-20').filter(a => a.date).length, 0);
});
test('un vrai record 5 km est détecté, daté du jour de la performance', () => {
  const s = fresh();
  s.activities.push(run('t1', '2026-12-16', 5, 30, { kind: 'test' }), run('t2', '2027-01-20', 5, 28.5, { kind: 'test' }));
  const a = get(s, 'run-pr-5k'); assert.equal(a.date, '2027-01-20'); assert.equal(a.status, 'unlocked');
});
test('un faux record GPS (allure impossible) n\'est pas attribué', () => {
  const s = fresh();
  s.activities.push(run('t1', '2026-12-16', 5, 30, { kind: 'test' }), run('gps', '2027-01-20', 5.1, 12, { kind: 'test' })); // 2'21/km : aberrant
  assert.equal(get(s, 'run-pr-5k').date, null);
  assert.equal(get(s, 'run-10k-first').date, null, 'pas de faux premier 10 km non plus');
});
test('un accomplissement n\'est débloqué qu\'une fois : date stable dans le temps, une seule mise en scène', () => {
  const s = fresh(); s.activities.push(run('r', '2026-11-25', 7, 46));
  assert.equal(get(s, 'run-45', '2026-11-26').date, '2026-11-25');
  assert.equal(get(s, 'run-45', '2027-02-01').date, '2026-11-25', 'jamais redaté « aujourd\'hui »');
  assert.equal(toCelebrate(s, '2026-11-26').filter(a => a.id === 'run-45').length, 1);
  s.celebrated = { 'run-45': 1 };
  assert.equal(toCelebrate(s, '2026-11-26').filter(a => a.id === 'run-45').length, 0);
});
test('une activité Strava arrivée en retard met à jour les accomplissements rétroactivement', () => {
  const s = fresh(); assert.equal(get(s, 'run-45', '2026-12-01').date, null);
  const it: StravaItem = { stravaId: '42', name: 'Footing', sportType: 'Run', date: '2026-11-25', distanceKm: 7.2, movingMin: 47, elapsedMin: 48, elevM: 30, avgHr: 140, maxHr: 155, perceived: 4, updatedAt: 2 };
  mergeStrava(s, [it]);
  assert.equal(get(s, 'run-45', '2026-12-01').date, '2026-11-25');
});
test('une activité supprimée ou corrigée entraîne une réévaluation', () => {
  const s = fresh(); mergeStrava(s, [{ stravaId: '42', name: 'Footing', sportType: 'Run', date: '2026-11-25', distanceKm: 7.2, movingMin: 47, elapsedMin: 48, elevM: 30, avgHr: 140, maxHr: 155, perceived: 4, updatedAt: 2 }]);
  mergeStrava(s, [{ stravaId: '42', name: 'Footing', sportType: 'Run', date: '2026-11-25', distanceKm: 6, movingMin: 38, elapsedMin: 39, elevM: 30, avgHr: 140, maxHr: 155, perceived: 4, updatedAt: 3 }]);
  assert.equal(get(s, 'run-45', '2026-12-01').date, null, 'corrigée sous 45 min');
  s.activities.push(run('m', '2026-11-27', 7, 46)); assert.ok(get(s, 'run-45', '2026-12-01').date);
  s.activities = s.activities.filter(a => a.id !== 'm'); assert.equal(get(s, 'run-45', '2026-12-01').date, null, 'supprimée');
});
test('record de charge et de répétitions : uniquement sur séries validées, comparé au passé', () => {
  const s = fresh();
  s.strength['2026-11-01'] = { ex: { f1: { kg: ['40', '40'], reps: ['8', '8'], done: [true, true] } } };
  assert.equal(get(s, 'str-pr-load').date, null, 'une première séance n\'est pas un record');
  s.strength['2026-11-15'] = { ex: { f1: { kg: ['40', '45'], reps: ['10', '6'], done: [true, true] } } };
  assert.equal(get(s, 'str-pr-load').date, '2026-11-15'); assert.match(get(s, 'str-pr-load').detail!, /45 kg/);
  assert.equal(get(s, 'str-pr-reps').date, '2026-11-15'); assert.match(get(s, 'str-pr-reps').detail!, /10 répétitions à 40 kg/);
});
test('quatre semaines cohérentes : daté de la fin de la 4e semaine ; les optionnelles non faites ne pénalisent pas', () => {
  const s = fresh(); for (let w = 6; w <= 9; w++) fillWeek(s, w); // aucun renforcement (optionnel) fait
  assert.ok(weekSuccess(s, '2026-12-20').filter(w => w.w >= 6 && w.w <= 9).every(w => w.ok));
  assert.equal(get(s, 'reg-4w', '2026-12-20').date, addDays(weekStart(s, 9), 6));
});
test('semaine allégée respectée : valorisée (accomplissement + bilan)', () => {
  const s = fresh(); fillWeek(s, 12, 0.67);
  assert.equal(get(s, 'rec-deload', '2027-01-10').date, addDays(weekStart(s, 12), 6));
  const r = buildRecap(s, 12);
  assert.ok(r.success); assert.ok(r.cards.some(c => c.kind === 'worked' && c.lines.some(l => /levé le pied/.test(l))));
  assert.ok(r.cards.some(c => c.kind === 'milestones' && c.lines.some(l => /allégée/.test(l))));
});
test('adaptation bien gérée : check-in rouge, récupération active faite', () => {
  const s = fresh(); const d = '2026-12-02';
  s.checkins[d] = { sleep: 'mal', energy: 1, soreness: 'non', pain: 'non', motivation: 3 };
  s.activities.push({ id: 'rec', date: d, type: 'marche', title: 'Récupération active', durationMin: 40, source: 'manuel', matched: d, complementary: false });
  assert.equal(get(s, 'rec-adapt', '2026-12-05').date, d);
});
test('la clôture indique ce que la séance fait avancer', () => {
  const s = fresh(); const a = run('r', '2026-11-25', 7, 46); s.activities.push(a);
  assert.ok(contribution(s, a, '2026-11-25').some(x => x.id === 'run-45' && x.unlocked));
});
test('prochain jalon : le plus avancé parmi ceux qui restent', () => {
  const s = fresh(); s.activities.push(run('r', '2026-11-25', 6, 40));
  const n = nextMilestone(s, '2026-11-26'); assert.ok(n); assert.equal(n!.date, null);
});
test('parcours : 5 chapitres sur les phases réelles, un seul en cours', () => {
  const ch = chapters(fresh(), '2026-11-20');
  assert.deepEqual(ch.map(c => c.n), ['A', 'B', 'C', 'D', 'E']);
  assert.equal(ch.filter(c => c.state === 'en cours').length, 1); assert.equal(ch[1].state, 'en cours');
  assert.equal(ch[0].state, 'terminé'); assert.ok(ch[0].bilan);
});

/* ---------- Calories (estimations Strava) ---------- */
const cal = (id: string, date: string, kcal: number | null, checked = true): StravaItem => ({ stravaId: id, name: 'X', sportType: 'Run', date, distanceKm: 5, movingMin: 30, elapsedMin: 31, elevM: 10, avgHr: 150, maxHr: 170, updatedAt: 1, calories: kcal, caloriesChecked: checked });
test('calories : valeur disponible, absente, en attente', () => {
  const s = fresh(); mergeStrava(s, [cal('1', '2026-11-02', 300), cal('2', '2026-11-03', null), cal('3', '2026-11-04', null, false)]);
  const e = energy(s, '2026-11-02', '2026-11-08');
  assert.equal(e.total, 300); assert.equal(e.withData, 1); assert.equal(e.pending, 1); assert.equal(e.count, 3);
  assert.match(coverage(e), /1 activité sur 3/, 'une somme partielle n\'est jamais présentée comme le total');
});
test('calories : activité modifiée puis supprimée, agrégats mis à jour', () => {
  const s = fresh(); mergeStrava(s, [cal('1', '2026-11-02', 300), cal('2', '2026-11-03', 200)]);
  assert.equal(energy(s, '2026-11-02', '2026-11-08').total, 500);
  mergeStrava(s, [{ ...cal('1', '2026-11-02', 350), updatedAt: 2 }]); assert.equal(energy(s, '2026-11-02', '2026-11-08').total, 550);
  mergeStrava(s, [{ ...cal('2', '2026-11-03', 200), deleted: true, updatedAt: 3 }]); assert.equal(energy(s, '2026-11-02', '2026-11-08').total, 350);
});
test('calories : le bilan précise le nombre d\'activités couvertes ; elles ne valident ni ne notent une séance', () => {
  const s = fresh(); mergeStrava(s, [cal('1', '2026-11-04', 300)]); s.activities.push(run('m', '2026-11-05', 5, 30));
  const line = buildRecap(s, 4).cards[0].lines.find(l => /kcal/.test(l))!;
  assert.match(line, /300 kcal sur 1 activité sur 2/);
  const walk = fresh(); mergeStrava(walk, [{ ...cal('9', '2026-11-04', 120), sportType: 'Walk' }]);
  assert.equal(energy(walk, '2026-11-02', '2026-11-08').total, 120, 'la promenade compte dans la dépense');
  assert.equal(walk.activities.find(a => a.stravaId === '9')!.complementary, true, 'mais pas dans la régularité');
});
test('les sorties d\'avant le programme (vieux Strava) ne valident aucun jalon, mais restent des records personnels', async () => {
  const { recordsUntil } = await import('../records');
  const s = fresh(); const before = addDays(s.program.start, -30);
  s.activities.push(run('old1', before, 10, 55, { kind: 'test' }), run('old2', addDays(before, 2), 5, 24, { kind: 'test' }), run('old3', addDays(before, 4), 8, 50));
  const xs = achievementsFor(s, addDays(s.program.start, 3));
  assert.equal(xs.filter(a => a.date).length, 0, 'aucun jalon validé par l\'historique');
  assert.ok(recordsUntil(s, addDays(s.program.start, 3)).some(r => r.id === 'run-10k'), 'le 10 km d\'avant reste un record perso');
  s.activities.push(run('in1', addDays(s.program.start, 1), 8, 50));
  assert.equal(get(s, 'run-45', addDays(s.program.start, 3)).date, addDays(s.program.start, 1));
});
