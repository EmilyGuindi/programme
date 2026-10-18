import { adapted, comparable, countsFor, DELOAD, doneOn, PHASES, recovery, weekOf, weekStart } from './coach';
import { addDays, fmtShort, mmss, num } from './dates';
import { EX } from './library';
import { weekSuccess } from './journey';
import { isOnKey } from './session';
import { eventState } from './status';
import type { Activity, AppState, ISODate } from './types';

/* ============================================================
   Accomplissements BYYND — l'unique système de paliers (remplace l'ancienne liste de journey.ts, mêmes paliers repris).
   Règles déterministes, calculées à partir des données : une activité arrivée en retard, corrigée ou supprimée
   met à jour le résultat au prochain calcul. La date est celle des données qui remplissent le critère, jamais « aujourd'hui ».
   Un accomplissement n'existe qu'une fois (identifiant stable) ; seule sa mise en scène est mémorisée (AppState.celebrated).
   ============================================================ */

export type AchCat = 'running' | 'force' | 'competition' | 'regularite' | 'recuperation';
export const CAT_LABEL: Record<AchCat, string> = { running: 'Running', force: 'Force', competition: 'Compétitions', regularite: 'Régularité', recuperation: 'Récupération' };
export type AchStatus = 'locked' | 'progress' | 'unlocked';
export interface Achievement {
  id: string; cat: AchCat; title: string; description: string; criterion: string; tier: 'standard' | 'major';
  status: AchStatus; progress: { value: number; target: number; label: string } | null; source: string; date: ISODate | null; detail?: string;
}

const plausible = (a: Activity) => !!(a.distanceKm && a.durationMin) && (a.durationMin! * 60) / a.distanceKm! >= 180 && (a.durationMin! * 60) / a.distanceKm! <= 720;
const pace = (a: Activity) => (a.durationMin! * 60) / a.distanceKm!;
const runsOf = (s: AppState, until: ISODate) => s.activities.filter(a => (a.type === 'running' || a.type === 'course') && !a.complementary && a.date <= until).sort((a, b) => a.date.localeCompare(b.date));
const SRC = { act: 'Activités (Strava ou saisies)', race: 'Résultats de course', str: 'Séries cochées et charges notées', prog: 'Séances du programme', ci: 'Check-ins' };

/** Efforts chronométrés sur une distance : résultats de course, puis tests et courses enregistrés (sans compter deux fois la même course). */
function timedEfforts(s: AppState, until: ISODate, lo: number, hi: number) {
  const mid = (lo + hi) / 2;
  const ev = s.events.filter(e => e.result && e.date <= until && e.distanceKm && e.distanceKm >= lo && e.distanceKm <= hi).map(e => ({ date: e.date, t: (e.result!.time * mid) / e.distanceKm!, label: e.name }));
  const acts = runsOf(s, until).filter(a => plausible(a) && (a.kind === 'test' || a.type === 'course') && a.distanceKm! >= lo && a.distanceKm! <= hi && !(a.eventId && s.events.some(e => e.id === a.eventId && e.result)))
    .map(a => ({ date: a.date, t: (a.durationMin! * 60 * mid) / a.distanceKm!, label: a.title }));
  return [...ev, ...acts].sort((a, b) => a.date.localeCompare(b.date));
}
/** Première amélioration d'un meilleur temps précédent (au moins 1 s). */
function firstImprovement<T extends { date: ISODate; t: number }>(xs: T[]) { let best = Infinity; for (const x of xs) { if (best !== Infinity && x.t < best - 1) return x; best = Math.min(best, x.t); } return null; }

export function achievementsFor(s: AppState, today: ISODate): Achievement[] {
  const out: Achievement[] = [];
  const add = (a: Omit<Achievement, 'status'> & { status?: AchStatus }) => out.push({ ...a, status: a.date ? 'unlocked' : a.progress && a.progress.value > 0 ? 'progress' : 'locked' });
  const runs = runsOf(s, today).filter(plausible);
  const ws = weekSuccess(s, today);

  /* ---------- Running ---------- */
  const comfy = runs.filter(r => r.type === 'running' && (r.effort != null ? r.effort <= 5 : (r.kind || 'facile') === 'facile'));
  const r45 = comfy.find(r => (r.durationMin || 0) >= 45);
  const longest = Math.max(0, ...comfy.map(r => r.durationMin || 0));
  add({ id: 'run-45', cat: 'running', tier: 'standard', title: 'Première sortie de 45 min confortable', description: 'Courir 45 minutes en aisance respiratoire.', criterion: 'Une sortie d\'au moins 45 min, effort ressenti 5/10 ou moins (ou footing facile sans effort noté).', source: SRC.act,
    progress: { value: Math.min(45, Math.round(longest)), target: 45, label: longest ? `Plus longue sortie confortable : ${Math.round(longest)} min` : 'Aucune sortie confortable pour l\'instant' }, date: r45?.date || null });

  let streak = 0, regDate: ISODate | null = null; const curW = weekOf(s, today);
  for (let w = 1; w <= Math.min(curW, s.program.weeks); w++) {
    const from = weekStart(s, w), to = addDays(from, 6);
    const easy = runs.find(r => r.date >= from && r.date <= to && r.type === 'running' && (r.kind || 'facile') === 'facile');
    if (easy) { streak++; if (streak === 4 && !regDate) regDate = easy.date; } else if (w < curW) streak = 0;
  }
  add({ id: 'run-regular', cat: 'running', tier: 'standard', title: 'Footing régulier', description: 'Quatre semaines d\'affilée avec au moins un footing facile.', criterion: 'Au moins un footing facile par semaine du cycle, 4 semaines consécutives.', source: SRC.act,
    progress: { value: Math.min(4, streak), target: 4, label: `${Math.min(4, streak)} semaine${streak > 1 ? 's' : ''} sur 4` }, date: regDate });

  const first10 = runs.find(r => r.distanceKm! >= 9.9);
  const far = Math.max(0, ...runs.map(r => r.distanceKm || 0));
  add({ id: 'run-10k-first', cat: 'running', tier: 'standard', title: 'Premier 10 km', description: 'Ta première sortie ou course de 10 km enregistrée.', criterion: 'Une activité de course d\'au moins 9,9 km avec une allure plausible (GPS aberrant exclu).', source: SRC.act,
    progress: { value: Math.min(10, Math.round(far * 10) / 10), target: 10, label: far ? `Plus longue distance : ${String(Math.round(far * 10) / 10).replace('.', ',')} km` : 'Pas encore de sortie mesurée' }, date: first10?.date || null });

  for (const [id, lo, hi, km, tier] of [['run-pr-5k', 4.95, 5.2, 5, 'standard'], ['run-pr-10k', 9.9, 10.3, 10, 'major']] as const) {
    const xs = timedEfforts(s, today, lo, hi); const imp = firstImprovement(xs);
    const best = xs.length ? Math.min(...xs.map(x => x.t)) : null;
    add({ id, cat: 'running', tier, title: `Record battu sur ${km} km`, description: `Battre ton meilleur temps fiable sur ${km} km.`, criterion: `Un ${km} km chronométré (course ou test) plus rapide que ton précédent meilleur temps. Les allures GPS aberrantes sont exclues.`, source: `${SRC.race}, tests`,
      progress: { value: xs.length ? 1 : 0, target: 2, label: best ? `Repère actuel : ${mmss(best / km)} /km` : `Pas encore de ${km} km chronométré` }, date: imp?.date || null, detail: imp ? `${mmss(imp.t / km)} /km · ${imp.label}` : undefined });
  }

  const easyRuns = runs.filter(r => r.type === 'running' && (r.kind || 'facile') === 'facile');
  let endu: Activity | null = null;
  for (let i = 0; i < easyRuns.length && !endu; i++) {
    const cur = easyRuns[i]; const cmp = easyRuns.slice(0, i).filter(r => comparable(r, cur)).slice(-4);
    if (cmp.length < 2) continue;
    const gain = cmp.reduce((t, r) => t + pace(r), 0) / cmp.length - pace(cur);
    const eff = cur.effort != null && cmp.every(r => r.effort != null) ? cur.effort - cmp.reduce((t, r) => t + (r.effort || 0), 0) / cmp.length : null;
    if (gain > 5 && (eff == null || eff <= 0.5)) endu = cur;
  }
  const lastEasy = easyRuns[easyRuns.length - 1]; const nCmp = lastEasy ? easyRuns.filter(r => r.id !== lastEasy.id && comparable(r, lastEasy)).length : 0;
  add({ id: 'run-endurance', cat: 'running', tier: 'standard', title: 'Endurance en progrès', description: 'Plus rapide à effort égal, sur des sorties comparables.', criterion: 'Un footing facile plus rapide de plus de 5 s/km que la moyenne de tes sorties comparables (distance et dénivelé proches), à effort ressenti similaire.', source: SRC.act,
    progress: { value: Math.min(2, nCmp), target: 2, label: `${Math.min(2, nCmp)} sortie${nCmp > 1 ? 's' : ''} comparable${nCmp > 1 ? 's' : ''} sur 2 nécessaires` }, date: endu?.date || null });

  /* ---------- Force ---------- */
  const days = Object.keys(s.strength).filter(d => d <= today).sort();
  const setsOf = (d: string, id: string) => { const e = s.strength[d]?.ex?.[id]; if (!e) return []; return e.kg.map((k, i) => ({ kg: num(k), reps: num(e.reps[i]), ok: e.done[i] || isOnKey(s, d, `set:${id}:${i + 1}`) || num(e.reps[i]) != null })).filter(x => x.kg && x.kg > 0 && x.kg < 400 && x.ok) as { kg: number; reps: number | null }[]; };
  const MAIN = ['f1', 'f2', 'f3', 'm1', 'm2', 'm3', 'm4'];
  let loadPr: { date: ISODate; txt: string } | null = null, repPr: { date: ISODate; txt: string } | null = null;
  for (const id of MAIN) {
    let bestKg = 0; const hist: { kg: number; reps: number }[] = [];
    for (const d of days) {
      const ss = setsOf(d, id); if (!ss.length) continue;
      const top = Math.max(...ss.map(x => x.kg));
      if (bestKg && top > bestKg && (!loadPr || d < loadPr.date)) loadPr = { date: d, txt: `${EX[id].name.split(',')[0]} : ${String(top).replace('.', ',')} kg` };
      // record de répétitions : plus de répétitions que toutes les séries précédentes faites à une charge égale ou supérieure
      for (const x of ss) { const prev = hist.filter(h => h.kg >= x.kg); if (x.reps && prev.length && x.reps > Math.max(...prev.map(h => h.reps)) && (!repPr || d < repPr.date)) repPr = { date: d, txt: `${EX[id].name.split(',')[0]} : ${x.reps} répétitions à ${String(x.kg).replace('.', ',')} kg` }; }
      bestKg = Math.max(bestKg, top); ss.forEach(x => x.reps && hist.push({ kg: x.kg, reps: x.reps }));
    }
  }
  const logged = days.filter(d => MAIN.some(id => setsOf(d, id).length)).length;
  add({ id: 'str-pr-load', cat: 'force', tier: 'standard', title: 'Record de charge', description: 'Soulever plus lourd que jamais sur un exercice suivi.', criterion: 'Une série validée à une charge supérieure à ta meilleure charge précédente sur le même exercice.', source: SRC.str,
    progress: { value: Math.min(2, logged), target: 2, label: logged ? `${logged} séance${logged > 1 ? 's' : ''} avec charges notées` : 'Note tes charges : la comparaison commence à la 2e séance' }, date: loadPr?.date || null, detail: loadPr?.txt });
  add({ id: 'str-pr-reps', cat: 'force', tier: 'standard', title: 'Record de répétitions', description: 'Plus de répétitions qu\'avant, à charge égale ou supérieure.', criterion: 'Une série validée avec plus de répétitions que toutes tes séries précédentes à une charge égale ou inférieure.', source: SRC.str,
    progress: { value: Math.min(2, logged), target: 2, label: logged ? `${logged} séance${logged > 1 ? 's' : ''} avec charges notées` : 'Note charges et répétitions de chaque série' }, date: repPr?.date || null, detail: repPr?.txt });
  let progDate: ISODate | null = null; const prog = new Set<string>();
  for (const d of days) for (const id of ['f1', 'm1', 'm2', 'm3']) { const firstD = days.find(x => setsOf(x, id).length); if (!firstD || d <= firstD) continue; const f = Math.max(...setsOf(firstD, id).map(x => x.kg)); const ss = setsOf(d, id); if (ss.length && Math.max(...ss.map(x => x.kg)) > f) { prog.add(id); if (prog.size >= 2 && !progDate) progDate = d; } }
  add({ id: 'str-progress', cat: 'force', tier: 'standard', title: 'Progression en renforcement', description: 'Tes exercices principaux progressent.', criterion: 'Sur au moins 2 exercices principaux (hip thrust, landmine, tirage, rowing), une charge supérieure à ta première séance.', source: SRC.str,
    progress: { value: Math.min(2, prog.size), target: 2, label: `${Math.min(2, prog.size)} exercice${prog.size > 1 ? 's' : ''} sur 2` }, date: progDate });
  const strSessions = [...new Set([...s.activities.filter(a => a.type === 'renfo' && countsFor(a, a.date) && a.date <= today).map(a => a.date), ...days.filter(d => MAIN.some(id => setsOf(d, id).length))])].sort();
  add({ id: 'str-regular', cat: 'force', tier: 'standard', title: 'Renforcement régulier', description: 'Quatre séances de renforcement réalisées.', criterion: '4 séances de renforcement terminées ou avec des séries validées.', source: `${SRC.str}, ${SRC.prog.toLowerCase()}`,
    progress: { value: Math.min(4, strSessions.length), target: 4, label: `${Math.min(4, strSessions.length)} séance${strSessions.length > 1 ? 's' : ''} sur 4` }, date: strSessions[3] || null });

  /* ---------- Compétitions ---------- */
  const races = s.events.filter(e => e.date <= today && eventState(s, e, today) === 'done').sort((a, b) => a.date.localeCompare(b.date));
  add({ id: 'race-first', cat: 'competition', tier: 'standard', title: 'Première compétition terminée', description: 'Terminer une course ou un événement enregistré.', criterion: 'Un événement avec un résultat, une activité rattachée ou marqué comme fait.', source: `${SRC.race}, Strava`,
    progress: null, date: races[0]?.date || null, detail: races[0]?.name });
  add({ id: 'race-3', cat: 'competition', tier: 'standard', title: 'Trois compétitions', description: 'Trois événements terminés : l\'expérience de course s\'installe.', criterion: '3 événements terminés.', source: `${SRC.race}, Strava`,
    progress: { value: Math.min(3, races.length), target: 3, label: `${Math.min(3, races.length)} sur 3` }, date: races[2]?.date || null });
  const official = s.events.filter(e => e.result && e.distanceKm && e.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const opr = official.find((e, i) => official.slice(0, i).some(p => p.distanceKm === e.distanceKm) && e.result!.time < Math.min(...official.slice(0, i).filter(p => p.distanceKm === e.distanceKm).map(p => p.result!.time)) - 1);
  add({ id: 'race-pr', cat: 'competition', tier: 'major', title: 'Record officiel', description: 'Un meilleur temps officiel en course sur une même distance.', criterion: 'Un résultat de course plus rapide que ton précédent résultat sur la même distance.', source: SRC.race,
    progress: { value: official.length ? 1 : 0, target: 2, label: official.length ? `${official.length} résultat${official.length > 1 ? 's' : ''} officiel${official.length > 1 ? 's' : ''}` : 'Pas encore de résultat officiel' }, date: opr?.date || null, detail: opr?.name });

  /* ---------- Régularité ---------- */
  let st = 0, reg4: ISODate | null = null;
  for (const w of ws) { st = w.ok ? st + 1 : 0; if (st === 4 && !reg4) reg4 = addDays(weekStart(s, w.w), 6); }
  add({ id: 'reg-4w', cat: 'regularite', tier: 'standard', title: 'Quatre semaines cohérentes', description: 'Quatre semaines d\'affilée fidèles au programme. Une semaine allégée bien suivie compte.', criterion: '4 semaines consécutives avec au moins 75 % des séances prévues (60 % en semaine allégée). Repos et optionnelles ne comptent pas contre toi.', source: SRC.prog,
    progress: { value: Math.min(4, st), target: 4, label: `${Math.min(4, st)} semaine${st > 1 ? 's' : ''} sur 4` }, date: reg4 });
  const okW = ws.filter(w => w.ok); const w10 = okW[9];
  add({ id: 'reg-10w', cat: 'regularite', tier: 'standard', title: '10 semaines réussies', description: 'Pas forcément d\'affilée : la régularité se mesure sur la durée.', criterion: '10 semaines réussies dans le cycle.', source: SRC.prog,
    progress: { value: Math.min(10, okW.length), target: 10, label: `${Math.min(10, okW.length)} sur 10` }, date: w10 ? addDays(weekStart(s, w10.w), 6) : null });
  const phaseRate = (from: number, to: number) => { let p = 0, d = 0; for (let x = weekStart(s, from); x <= addDays(weekStart(s, to), 6); x = addDays(x, 1)) { const a = adapted(s, x); if (a.mandatory && !a.skipped) { p++; if (doneOn(s, x)) d++; } } return p ? d / p : 0; };
  const donePh = PHASES.find(ph => addDays(weekStart(s, ph.to), 6) < today && phaseRate(ph.from, ph.to) >= 0.6);
  const curPh = PHASES.find(ph => curW <= ph.to) || PHASES[PHASES.length - 1];
  add({ id: 'reg-phase', cat: 'regularite', tier: 'standard', title: 'Chapitre bouclé', description: 'Un chapitre du parcours terminé avec au moins 60 % des séances prévues.', criterion: 'Fin d\'une phase du programme avec au moins 60 % des séances prévues réalisées.', source: SRC.prog,
    progress: { value: Math.max(0, Math.min(curW, curPh.to) - curPh.from + 1), target: curPh.to - curPh.from + 1, label: `Phase ${curPh.n} · ${curPh.name}` }, date: donePh ? addDays(weekStart(s, donePh.to), 6) : null, detail: donePh ? `Phase ${donePh.n} · ${donePh.name}` : undefined });
  const end = addDays(weekStart(s, s.program.weeks), 6);
  add({ id: 'reg-cycle', cat: 'regularite', tier: 'major', title: 'Premier cycle terminé', description: `${s.program.weeks} semaines, du ${fmtShort(s.user.startDate)} au ${fmtShort(end)}.`, criterion: 'Arriver au bout du cycle avec au moins 60 % des séances prévues réalisées.', source: SRC.prog,
    progress: { value: Math.max(0, Math.min(s.program.weeks, curW - 1)), target: s.program.weeks, label: `Semaine ${Math.max(1, Math.min(s.program.weeks, curW))} sur ${s.program.weeks}` }, date: end < today && phaseRate(1, s.program.weeks) >= 0.6 ? end : null });
  const cis = Object.keys(s.checkins).filter(k => s.checkins[k].sleep && k <= today).sort();
  add({ id: 'reg-checkins', cat: 'regularite', tier: 'standard', title: '20 check-ins', description: 'Ton coach connaît de mieux en mieux ta récupération.', criterion: '20 check-ins remplis.', source: SRC.ci,
    progress: { value: Math.min(20, cis.length), target: 20, label: `${Math.min(20, cis.length)} sur 20` }, date: cis[19] || null });

  /* ---------- Récupération ---------- */
  const deload = ws.find(w => DELOAD.includes(w.w) && w.ok);
  add({ id: 'rec-deload', cat: 'recuperation', tier: 'standard', title: 'Semaine allégée respectée', description: 'Lever le pied quand c\'est prévu, c\'est aussi s\'entraîner.', criterion: `Semaine allégée (semaine ${DELOAD.join(', ')}) suivie : au moins 60 % des séances prévues, sans en rajouter.`, source: SRC.prog,
    progress: null, date: deload ? addDays(weekStart(s, deload.w), 6) : null });
  let adaptDay: ISODate | null = null;
  for (let d = s.user.startDate; d <= today && !adaptDay; d = addDays(d, 1)) {
    const a = adapted(s, d); const lv = recovery(s, d).level;
    if ((a.replaced || a.reason) && (lv === 'orange' || lv === 'rouge' || s.overrides[d]?.adj) && doneOn(s, d)) adaptDay = d;
  }
  add({ id: 'rec-adapt', cat: 'recuperation', tier: 'standard', title: 'Adaptation bien gérée', description: 'Fatigue ou douleur : tu as fait la version adaptée plutôt que forcer.', criterion: 'Un jour avec un check-in orange ou rouge (ou une adaptation acceptée) où la séance adaptée a été réalisée.', source: `${SRC.ci}, ${SRC.prog.toLowerCase()}`,
    progress: null, date: adaptDay });
  return out;
}

/** Version mémorisée pour l'interface : l'état du store est immuable (une copie par modification), on calcule une fois par état et par jour. */
const memo = new WeakMap<AppState, { today: ISODate; list: Achievement[] }>();
export function achievementsMemo(s: AppState, today: ISODate): Achievement[] {
  const m = memo.get(s); if (m && m.today === today) return m.list;
  const list = achievementsFor(s, today); memo.set(s, { today, list }); return list;
}

/** Accomplissements atteints, du plus récent au plus ancien. */
export const unlocked = (s: AppState, today: ISODate, list = achievementsFor(s, today)) => list.filter(a => a.date).sort((a, b) => b.date!.localeCompare(a.date!));

/** À mettre en scène : atteints, pas encore célébrés, et récents (un historique importé d'un coup n'est pas « célébré » rétroactivement). */
export function toCelebrate(s: AppState, today: ISODate, list = achievementsFor(s, today), windowDays = 10): Achievement[] {
  if (s.user.prefs.celebrate === false) return [];
  return unlocked(s, today, list).filter(a => !s.celebrated?.[a.id] && a.date! >= addDays(today, -windowDays));
}

/** Prochain jalon pertinent : le plus avancé parmi ceux qui ne sont pas atteints (catégorie préférée en premier). */
export function nextMilestone(s: AppState, today: ISODate, prefer?: AchCat, list = achievementsFor(s, today)): Achievement | null {
  // Les jalons qui avancent avec le calendrier (fin de chapitre, fin de cycle) ne sont pas des objectifs d'action.
  const open = list.filter(a => !a.date && a.progress && a.progress.target > 0 && a.id !== 'reg-cycle' && a.id !== 'reg-phase');
  const score = (a: Achievement) => a.progress!.value / a.progress!.target + (prefer && a.cat === prefer ? 0.25 : 0);
  return open.sort((a, b) => score(b) - score(a))[0] || null;
}

/** Ce qu'une activité a fait avancer : comparaison des accomplissements avec et sans elle. */
export function contribution(s: AppState, act: Activity, today: ISODate): { id: string; title: string; text: string; unlocked: boolean }[] {
  const without: AppState = { ...s, activities: s.activities.filter(a => a.id !== act.id) };
  const before = new Map(achievementsFor(without, today).map(a => [a.id, a]));
  return achievementsFor(s, today).flatMap((a): { id: string; title: string; text: string; unlocked: boolean }[] => {
    const b = before.get(a.id); if (!b) return [];
    if (a.date && !b.date) return [{ id: a.id, title: a.title, text: 'Débloqué', unlocked: true }];
    if (a.progress && b.progress && a.progress.value > b.progress.value && !a.date) return [{ id: a.id, title: a.title, text: a.progress.label, unlocked: false }];
    return [];
  });
}
