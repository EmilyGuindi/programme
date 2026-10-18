/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyChanges, diffProfile, parseProfile } from '../profile-import';
import { DEFAULT_STATE, migrate, seed } from '../state';
import type { AppState } from '../types';

const fresh = (): AppState => migrate(JSON.parse(JSON.stringify(seed(structuredClone(DEFAULT_STATE)))));

test('JSON valide : champs validés un par un, le reste ignoré', () => {
  const r = parseProfile(JSON.stringify({ schema: 'byynd-profile/1', goals: { run: '10 km en 55 min', weightTarget: 'beaucoup' }, events: [{ name: 'Semi de Lyon', date: '2027-04-04', distanceKm: 21.1 }, { name: 'Sans date' }], extra: { exec: 'rm -rf' } }));
  assert.ok(!('error' in r));
  if ('error' in r) return;
  assert.equal(r.profile.goals!.run, '10 km en 55 min'); assert.equal(r.profile.goals!.weightTarget, undefined);
  assert.equal(r.profile.events!.length, 1); assert.ok(r.warnings.length >= 1);
});

test('JSON cassé : erreur claire, aucun changement', () => { assert.ok('error' in parseProfile('{ "goals": ')); });

test('Markdown : clés reconnues', () => {
  const r = parseProfile('# Profil\n- Objectif course : 10 km en 52 min\n- Poids souhaité : 61 kg\n- Semi de Lyon, 2027-04-04, 21 km');
  if ('error' in r) throw new Error(r.error);
  assert.equal(r.profile.goals!.weightTarget, 61); assert.equal(r.profile.events![0].name, 'Semi de Lyon');
});

test('jamais d\'écrasement de Strava ; contradictions à cocher explicitement', () => {
  const s = fresh();
  s.activities.push({ id: 's1', date: '2026-10-16', type: 'running', title: 'Strava', distanceKm: 6, durationMin: 36, source: 'strava', complementary: false, matched: '2026-10-16' } as any);
  const r = parseProfile(JSON.stringify({ history: [{ date: '2026-10-16', type: 'running', km: 99, min: 10 }, { date: '2026-09-01', type: 'running', km: 8, min: 50 }], events: [{ name: '10 km de Lausanne', date: '2026-11-01' }] }));
  if ('error' in r) throw new Error(r.error);
  const ch = diffProfile(s, r.profile);
  assert.ok(ch.some(c => c.id === 'hist-skip' && c.kind === 'skip'));
  const conflict = ch.find(c => c.kind === 'conflict')!; assert.ok(conflict);
  applyChanges(s, ch, new Set(ch.filter(c => c.kind === 'add').map(c => c.id)));
  assert.equal(s.activities.find(a => a.id === 's1')!.distanceKm, 6);
  assert.equal(s.events.find(e => e.name === '10 km de Lausanne')!.date, '2026-10-25', 'contradiction non cochée : rien ne change');
  const imp = s.activities.find(a => a.date === '2026-09-01')!; assert.ok(imp.complementary, 'un import ne valide pas de séance');
});
