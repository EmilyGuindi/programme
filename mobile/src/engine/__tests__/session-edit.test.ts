/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adapted } from '../coach';
import { DEFAULT_STATE, seed } from '../state';
import { checkCall, execute, prepare, toolSchemas } from '../tools';
import type { AppState } from '../types';

const fresh = (): AppState => seed(structuredClone(DEFAULT_STATE));
const day = '2026-11-05', today = '2026-11-02';

test('le coach remplace une séance : proposition, puis application après confirmation seulement', () => {
  const s = fresh(); const before = adapted(s, day).title;
  const args = { date: day, type: 'run', title: 'Fractionné 6 × 400 m', dur: '45 min', steps: ['15 min facile', '6 × 400 m allure 5 km, récup 1 min 30', '10 min retour au calme'], intensity: 'qualite', reason: 'Tu veux travailler la vitesse' };
  const c = checkCall(s, 'set_session', args); assert.ok(c.ok);
  const p = prepare(s, 'set_session', args, today); assert.ok(p.executable); assert.match(p.summary, new RegExp(before.replace(/[()]/g, '.')));
  assert.equal(adapted(s, day).title, before, 'rien ne change à la proposition');
  const r = execute(s, 'set_session', args, today); assert.ok(r.ok);
  const a = adapted(s, day); assert.equal(a.type, 'run'); assert.equal(a.title, 'Fractionné 6 × 400 m'); assert.equal(a.run?.steps.length, 3); assert.ok(a.custom); assert.ok(a.mandatory);
  assert.ok(execute(s, 'restore_session', { date: day }, today).ok); assert.equal(adapted(s, day).title, before);
});
test('séance changée : jour passé, compétition et paramètres invalides refusés', () => {
  const s = fresh();
  assert.equal(prepare(s, 'set_session', { date: '2026-10-20', type: 'rest', title: 'Repos' }, today).executable, false);
  assert.equal(checkCall(s, 'set_session', { date: day, type: 'html', title: 'x' }).ok, false);
  assert.equal(checkCall(s, 'set_session', { date: day, type: 'run', title: 'x', steps: 'pas une liste' }).ok, false);
  assert.equal(checkCall(s, 'set_session', { date: day, type: 'run', title: 'x', steps: Array(13).fill('a') }).ok, false);
  assert.equal(checkCall(s, 'set_session', { date: day, type: 'run', title: 'x', script: 'rm' }).ok, false);
  const ev = s.events.find(e => e.date >= today)!; assert.equal(prepare(s, 'set_session', { date: ev.date, type: 'rest', title: 'Repos' }, today).executable, false);
});
test('le schéma de set_session expose les étapes comme une liste', () => {
  const sc = toolSchemas().find(t => t.name === 'set_session')!; assert.equal((sc.input_schema.properties as any).steps.type, 'array');
});
test('élan : séances du programme, série et mot du coach local, sans l\'historique d\'avant', async () => {
  const { momentum, localWord } = await import('../momentum');
  const s = fresh(); s.activities.push({ id: 'old', date: '2026-09-01', type: 'crossfit', title: 'CrossFit', complementary: false, matched: '2026-09-01', source: 'strava', durationMin: 60 });
  const m = momentum(s, today); assert.ok(m.planned > 0); assert.ok(m.done <= m.planned); assert.equal(m.week >= 1, true);
  const w = localWord(s, today, m); assert.ok(w.length > 10 && w.length < 260);
});
