/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeStates } from '../merge';
import { DEFAULT_STATE, seed } from '../state';
import type { AppState } from '../types';

const fresh = (): AppState => seed(structuredClone(DEFAULT_STATE));

test('profil : la version modifiée le plus récemment l\'emporte, un état ancien n\'écrase pas un récent', () => {
  const old = fresh(); old.updatedAt = 1000; old.user.goals.weightTarget = 70;
  const recent = fresh(); recent.updatedAt = 5000; recent.user.goals.weightTarget = 66;
  assert.equal(mergeStates(old, recent).user.goals.weightTarget, 66);
  assert.equal(mergeStates(recent, old).user.goals.weightTarget, 66);
});

test('fusion : les données des deux côtés sont conservées', () => {
  const a = fresh(); a.updatedAt = 10; a.measurements = [{ id: 'm1', date: '2026-10-01', weight: 68 } as any];
  const b = fresh(); b.updatedAt = 20; b.measurements = [{ id: 'm2', date: '2026-10-08', weight: 67.5 } as any];
  const m = mergeStates(a, b);
  assert.deepEqual(m.measurements.map(x => x.id).sort(), ['m1', 'm2']);
  assert.equal(m.updatedAt, 20);
});
