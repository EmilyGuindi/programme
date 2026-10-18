/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adapted, doneOn, planFor, sessionKey } from '../coach';
import { mergeStates } from '../merge';
import { planReminders } from '../reminders';
import { applyMove, cancelMove, checkMove, setHabit } from '../reschedule';
import { isOn, sessionProgress, setCheck } from '../session';
import { DEFAULT_STATE, migrate, seed } from '../state';
import { dayStatus } from '../status';
import { mergeStrava } from '../strava';
import type { AppState } from '../types';

const fresh = (): AppState => seed(structuredClone(DEFAULT_STATE));
const reload = (s: AppState) => migrate(JSON.parse(JSON.stringify(s)));
const MON = '2026-10-19', TUE = '2026-10-20', WED = '2026-10-21', SAT = '2026-10-24', SUN = '2026-10-25', TODAY = '2026-10-18';

test('1. running du mercredi 21 au lundi 19 octobre : cohérent, même séance, même objectif', () => {
  const s = fresh(); const before = planFor(s, WED);
  const c = checkMove(s, WED, MON, TODAY);
  assert.equal(c.verdict, 'ok'); assert.ok(c.issues.some(i => i.code === 'easy-near-box'), 'mardi CrossFit vérifié');
  applyMove(s, WED, MON);
  const p = planFor(s, MON);
  assert.equal(p.type, 'run'); assert.equal(p.title, before.title); assert.deepEqual(p.run, before.run); assert.equal(p.movedFrom, WED);
  assert.equal(planFor(s, WED).type, 'rest'); assert.equal(planFor(s, WED).movedTo, MON);
  assert.equal(sessionKey(s, MON), WED, 'la séance garde son identifiant');
});
test('2. vers un jour occupé : CrossFit du mardi signalé avec des alternatives ; running/renfo proposés à l\'échange', () => {
  const s = fresh(); const c = checkMove(s, WED, TUE, TODAY);
  assert.equal(c.verdict, 'warn'); assert.ok(c.issues.some(i => i.code === 'busy-box')); assert.ok(c.alternatives.some(a => a.date === MON));
  const sw = checkMove(s, WED, SAT, TODAY); assert.equal(sw.swapWith?.date, SAT);
  applyMove(s, WED, SAT, true);
  assert.equal(planFor(s, SAT).movedFrom, WED); assert.equal(planFor(s, WED).movedFrom, SAT, 'échange : aucune séance perdue');
});
test('3. près d\'une compétition : jour de Lausanne bloqué, veille déconseillée, intensité signalée', () => {
  const s = fresh();
  assert.equal(checkMove(s, WED, SUN, TODAY).verdict, 'block');
  assert.ok(checkMove(s, WED, SAT, TODAY).issues.some(i => i.code === 'race-eve'));
  const q = checkMove(s, '2026-12-02', '2026-12-04', '2026-11-30'); // seuil déplacé : pas de course proche, mais vérifié
  assert.notEqual(q.verdict, 'block');
  s.events.push({ id: 'ev-5k', name: '5 km test', type: 'course', date: '2026-12-06', distanceKm: 5, priority: 'objectif', status: 'prévu' });
  assert.ok(checkMove(s, '2026-12-02', '2026-12-04', '2026-11-30').issues.some(i => i.code === 'race-near'));
});
test('4. une seule semaine : la semaine suivante garde son mercredi', () => {
  const s = fresh(); applyMove(s, WED, MON);
  assert.equal(planFor(s, '2026-10-28').type, 'run'); assert.equal(planFor(s, '2026-10-26').movedFrom, undefined);
});
test('5. récurrent : le running du mercredi passe au lundi chaque semaine, sans toucher les séances fixées ni les jours de course', () => {
  const s = fresh(); setHabit(s, 'run', 2, 0, '2026-11-09');
  assert.equal(planFor(s, '2026-11-16').type, 'run'); assert.equal(planFor(s, '2026-11-16').movedFrom, '2026-11-18');
  assert.equal(planFor(s, '2026-11-18').type, 'rest');
  assert.equal(planFor(s, '2026-11-02').movedFrom, undefined, 'avant la date de départ : inchangé');
  assert.equal(planFor(s, '2026-12-28').run?.title, planFor(fresh(), '2026-12-30').run?.title, 'contenu de la semaine conservé');
});
test('6. annuler : retour à la programmation initiale (échange compris)', () => {
  const s = fresh(); applyMove(s, WED, SAT, true); cancelMove(s, SAT);
  assert.equal(planFor(s, WED).movedFrom, undefined); assert.equal(planFor(s, SAT).movedFrom, undefined); assert.equal(planFor(s, WED).type, 'run');
  setHabit(s, 'run', 2, 0, '2026-11-09'); setHabit(s, 'run', 2, 2, '2026-11-09');
  assert.equal(planFor(s, '2026-11-18').type, 'run');
});
test('7. fermeture et réouverture : le déplacement est conservé', () => {
  const s = fresh(); applyMove(s, WED, MON); const r = reload(s);
  assert.equal(planFor(r, MON).movedFrom, WED);
});
test('8. Strava après déplacement : le footing du lundi valide la séance déplacée, pas de doublon', () => {
  const s = fresh(); applyMove(s, WED, MON);
  const it = { stravaId: '5', name: 'Footing', sportType: 'Run', date: MON, distanceKm: 5.5, movingMin: 36, elapsedMin: 37, elevM: 20, avgHr: 145, maxHr: 160, updatedAt: 1 };
  mergeStrava(s, [it]); mergeStrava(s, [it]);
  assert.ok(doneOn(s, MON)); assert.equal(s.activities.filter(a => a.stravaId === '5').length, 1);
  assert.equal(s.activities.find(a => a.stravaId === '5')!.title, planFor(s, MON).title);
  assert.equal(dayStatus(s, adapted(s, WED), '2026-10-22'), 'rest', 'le mercredi quitté n\'est pas « manqué »');
});
test('9. aucune perte : coches et notes suivent la séance ; synchro entre appareils', () => {
  const s = fresh(); setCheck(s, WED, 'step:facile:1', true); s.runs[WED] = { km: '5' };
  applyMove(s, WED, MON);
  assert.ok(isOn(s, MON, 'step:facile:1')); assert.equal(sessionProgress(s, MON, MON).done, 1);
  setCheck(s, MON, 'step:facile:2', true); assert.ok(s.checks![WED]['step:facile:2'], 'rangée sous l\'identifiant de la séance');
  const other = fresh(); const m = mergeStates(other, s); assert.equal(planFor(m, MON).movedFrom, WED);
  cancelMove(s, MON, Date.now() + 10); const m2 = mergeStates(m, s); assert.equal(planFor(m2, MON).movedFrom, undefined, 'l\'annulation se synchronise aussi');
});
test('10. programme et récupération : plafond, enchaînements, fatigue signalée, rappels', () => {
  const s = fresh();
  const tight = checkMove(s, WED, '2026-10-23', TODAY); assert.ok(tight.issues.some(i => i.code === 'streak'), '4 jours d\'affilée signalés');
  s.checkins[MON] = { sleep: 'mal', energy: 1, soreness: 'fortes', pain: 'non', motivation: 2 };
  assert.ok(checkMove(s, WED, MON, TODAY).issues.some(i => i.code === 'fatigue'));
  applyMove(s, WED, MON); assert.equal(adapted(s, MON).replaced?.type, 'recup', 'le moteur d\'adaptation s\'applique au nouveau jour');
  const r = fresh(); applyMove(r, WED, MON);
  const rem = planReminders(r, new Date(2026, 9, 18, 20, 0)).find(x => x.id.endsWith(MON) && x.kind !== "weigh")!;
  assert.match(rem.body, /footing facile 35 min \(séance déplacée\)/);
});
