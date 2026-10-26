/// <reference types="node" />
import { programEnd } from '../generator';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planFor, programAt } from '../coach';
import { achievementsFor } from '../achievements';
import { mergeStates } from '../merge';
import { activate, analyzeCycle, blocking, makeDraft, rollover, saveDraft, suggestedStart, suggestWeeks, validateProgram } from '../programs';
import { DEFAULT_STATE, migrate, seed } from '../state';
import type { AppState, ProgramSpec } from '../types';

const fresh = (): AppState => migrate(JSON.parse(JSON.stringify(seed(structuredClone(DEFAULT_STATE)))));
const SPEC: ProgramSpec = { days: ['rest', 'crossfit', 'run', 'crossfit', 'rest', 'hyrox', 'long'], focus: '10k', deloadEvery: 4, tests: true };

test('le cycle d\'origine est reconnu et inchangé', () => {
  const s = fresh();
  assert.equal(s.program.template, 'cycle1');
  assert.equal(planFor(s, '2026-10-20').title, 'CrossFit, effort ≤ 7/10');
  assert.equal(planFor(s, '2026-11-18').type, 'run');
});

test('suite proposée après le cycle, durée non fixée à 20 semaines', () => {
  const s = fresh();
  assert.equal(suggestedStart(s, '2026-10-18'), '2027-03-01');
  assert.equal(suggestWeeks('2027-03-01', null), 12);
  assert.equal(suggestWeeks('2027-03-01', '2027-05-16'), 12);
});

test('validation : règles de sécurité bloquantes', () => {
  const s = fresh();
  const noRest = makeDraft({ start: '2027-03-01', weeks: 10, spec: { ...SPEC, days: ['crossfit', 'crossfit', 'run', 'crossfit', 'hyrox', 'hyrox', 'long'] } });
  assert.ok(blocking(validateProgram(s, noRest, '2026-10-18')));
  const tuesday = makeDraft({ start: '2027-03-02', weeks: 10, spec: SPEC });
  assert.ok(validateProgram(s, tuesday, '2026-10-18').some(i => i.code === 'start-day' && i.severity === 'info'), 'un début en milieu de semaine est permis, signalé');
  const range = makeDraft({ start: '2027-03-03', end: '2027-05-16', weeks: 4, spec: SPEC });
  assert.equal(range.end, '2027-05-16'); assert.equal(range.weeks, 11); assert.equal(programEnd(range), '2027-05-16');
  assert.ok(!validateProgram(s, range, '2026-10-18').some(i => i.code === 'end' || i.code === 'weeks'));
  assert.ok(validateProgram(s, makeDraft({ start: '2027-03-03', end: '2027-03-10', weeks: 4, spec: SPEC }), '2026-10-18').some(i => i.code === 'end'));
  assert.ok(!validateProgram(s, makeDraft({ start: '2026-10-18', weeks: 10, spec: SPEC }), '2026-10-18').some(i => i.code === 'start-past'), 'commencer aujourd\'hui est permis');
  const past = makeDraft({ start: '2026-10-12', weeks: 10, spec: SPEC });
  assert.ok(validateProgram(s, past, '2026-10-18').some(i => i.code === 'start-past'));
  const ok = makeDraft({ start: '2027-03-01', weeks: 10, spec: SPEC });
  assert.ok(!blocking(validateProgram(s, ok, '2026-10-18')));
});

test('activation confirmée puis relais : historique conservé, nouveau calendrier appliqué', () => {
  const s = fresh();
  const d = makeDraft({ start: '2027-03-01', weeks: 10, spec: SPEC, name: 'Printemps' });
  saveDraft(s, d);
  assert.equal(programAt(s, '2027-03-02').id, 'c1', 'un brouillon ne change rien');
  const r = activate(s, d.id, '2026-12-01'); assert.ok(r.ok);
  assert.equal(s.program.id, 'c1', 'avant sa date, le cycle en cours reste en cours');
  assert.equal(programAt(s, '2027-03-02').id, d.id);
  assert.equal(planFor(s, '2027-03-02').title, 'CrossFit');
  assert.equal(planFor(s, '2027-03-07').type, 'run'); // sortie longue
  assert.ok(rollover(s, '2027-03-01'));
  assert.equal(s.program.id, d.id);
  const old = s.programs!.find(p => p.id === 'c1')!;
  assert.equal(old.status, 'done'); assert.ok(old.summary);
  assert.equal(planFor(s, '2026-10-20').title, 'CrossFit, effort ≤ 7/10', 'les dates passées gardent leur programme');
});

test('activation anticipée : le cycle en cours est raccourci, pas effacé', () => {
  const s = fresh();
  const d = makeDraft({ start: '2027-01-04', weeks: 8, spec: SPEC }); saveDraft(s, d);
  const r = activate(s, d.id, '2026-12-01'); assert.ok(r.ok);
  assert.equal(s.program.end, '2027-01-03');
  assert.equal(programAt(s, '2027-01-05').id, d.id);
});

test('accomplissements : rien n\'est remis à zéro au changement de programme', () => {
  const s = fresh();
  s.activities.push({ id: 'r1', date: '2026-11-18', type: 'running', title: 'Footing', durationMin: 50, distanceKm: 7.5, effort: 4, source: 'manuel', complementary: false, matched: '2026-11-18' } as any);
  const before = achievementsFor(s, '2027-02-01').find(a => a.id === 'run-45')!;
  assert.equal(before.date, '2026-11-18');
  const d = makeDraft({ start: '2027-03-01', weeks: 10, spec: SPEC }); saveDraft(s, d); activate(s, d.id, '2027-02-01'); rollover(s, '2027-03-01');
  const after = achievementsFor(s, '2027-03-10');
  assert.equal(after.find(a => a.id === 'run-45')!.date, '2026-11-18');
  assert.ok(after.some(a => a.id === `cycle-${d.id}` && a.scope === 'program'));
});

test('synchro : un appareil resté sur l\'ancien programme ne fait pas reculer le relais', () => {
  const a = fresh(); a.updatedAt = 100;
  const b = structuredClone(a);
  const d = makeDraft({ start: '2027-03-01', weeks: 10, spec: SPEC }); saveDraft(b, d); activate(b, d.id, '2027-02-01'); rollover(b, '2027-03-01'); b.updatedAt = 200;
  a.updatedAt = 300; // modifié plus tard, mais sans connaître le nouveau programme
  const m = mergeStates(a, b);
  assert.equal(m.program.id, d.id);
  assert.ok(m.programs!.some(p => p.id === 'c1' && p.status === 'done'));
});

test('bilan du cycle : constats tirés des données', () => {
  const s = fresh();
  const an = analyzeCycle(s, s.program, '2026-12-01');
  assert.ok(an.findings.length >= 1);
  assert.equal(an.byDay.length, 7);
});

test('le générateur respecte ses propres règles de progression', () => {
  const s = fresh();
  for (const focus of ['10k', '5k', 'endurance', 'maintien'] as const) for (const weeks of [6, 10, 16, 24]) {
    const d = makeDraft({ start: '2027-03-01', weeks, spec: { ...SPEC, focus } });
    assert.ok(!validateProgram(s, d, '2026-10-18').some(i => i.code === 'ramp'), `${focus} ${weeks}`);
  }
});
