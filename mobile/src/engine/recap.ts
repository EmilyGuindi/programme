import { activitiesOn, adapted, countsFor, DELOAD, phaseOf, weekOf, weekStart } from './coach';
import { addDays, DAYS_SHORT, dow } from './dates';
import { newRecords } from './records';
import { insights } from './insights';
import { coverage, energy } from './energy';
import { eventState } from './status';
import { achievementsFor, nextMilestone, type AchCat } from './achievements';
import type { AppState, ISODate } from './types';

export type RecapCard = { kind: 'numbers' | 'sessions' | 'highlight' | 'progress' | 'records' | 'milestones' | 'worked' | 'recovery' | 'next'; title: string; lines: string[]; big?: string; bigLabel?: string; badges?: { cat: AchCat; major: boolean; title: string }[] };
export interface Recap { week: number; from: ISODate; to: ISODate; cards: RecapCard[]; success: boolean }

/** Bilan d'une semaine du cycle, recalculé à la demande : une activité arrivée en retard le met à jour sans doublon. */
export function buildRecap(s: AppState, w: number): Recap {
  const from = weekStart(s, w), to = addDays(from, 6); const cards: RecapCard[] = [];
  let planned = 0, done = 0, optional = 0, minutes = 0, km = 0; const sessions: string[] = []; const hard: { t: string; e: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i), a = adapted(s, d), acts = activitiesOn(s, d);
    const valid = acts.filter(x => countsFor(x, d));
    if (a.mandatory && !a.skipped) { planned++; if (valid.length) done++; }
    acts.filter(x => !x.complementary).forEach(x => {
      minutes += x.durationMin || 0; if (x.type === 'running' || x.type === 'course') km += x.distanceKm || 0;
      if (a.optional && countsFor(x, d)) optional++;
      sessions.push(`${DAYS_SHORT[dow(d)]} · ${x.title}${x.durationMin ? ` · ${Math.round(x.durationMin)} min` : ''}${x.distanceKm ? ` · ${String(x.distanceKm).replace('.', ',')} km` : ''}`);
      if (x.effort) hard.push({ t: `${x.title} (${DAYS_SHORT[dow(d)]})`, e: x.effort });
    });
  }
  const deload = DELOAD.includes(w); const ratio = planned ? done / planned : 0;
  const success = deload ? ratio >= 0.6 : ratio >= 0.75;
  cards.push({ kind: 'numbers', title: deload ? 'Semaine allégée' : `Semaine ${w}`, big: `${done}/${planned}`, bigLabel: 'séances prévues réalisées',
    lines: [optional ? `+ ${optional} séance${optional > 1 ? 's' : ''} optionnelle${optional > 1 ? 's' : ''}` : '', minutes ? `${Math.round(minutes)} min d'entraînement` : '', km ? `${String(Math.round(km * 10) / 10).replace('.', ',')} km courus` : '',
      (() => { const e = energy(s, from, to); return e.withData ? `Dépense estimée par ta montre : ${e.total.toLocaleString('fr-FR')} kcal sur ${coverage(e)}` : ''; })(),
      deload && success ? 'Une semaine allégée bien respectée, c\'est exactement ce qu\'il fallait.' : success ? 'Semaine réussie.' : planned ? 'Semaine incomplète : rien à rattraper, la suite s\'ajuste.' : ''].filter(Boolean) });
  if (sessions.length) cards.push({ kind: 'sessions', title: 'Tes séances', lines: sessions });
  const ev = s.events.find(e => e.date >= from && e.date <= to && eventState(s, e, to) === 'done');
  const top = hard.sort((a, b) => b.e - a.e)[0];
  if (ev) cards.push({ kind: 'highlight', title: 'Ton moment fort', lines: [`${ev.name} : terminé.`] });
  else if (top && top.e >= 7) cards.push({ kind: 'highlight', title: 'Ton moment fort', lines: [`${top.t}, ressenti ${top.e}/10.`] });
  const ins = insights(s, to).filter(i => i.level !== 'observation' || i.domain === 'running').slice(0, 3);
  if (ins.length) cards.push({ kind: 'progress', title: 'Ce qui évolue', lines: ins.map(i => i.text) });
  const rec = newRecords(s, from, to);
  if (rec.length) cards.push({ kind: 'records', title: rec.length > 1 ? 'Nouveaux records' : 'Nouveau record', lines: rec.map(r => `${r.label} : ${r.value}`) });
  // calculé au lendemain du dimanche : la semaine est alors complète (régularité, semaine allégée)
  const ach = achievementsFor(s, addDays(to, 1)).filter(a => a.date && a.date >= from && a.date <= to);
  if (ach.length) cards.push({ kind: 'milestones', title: ach.length > 1 ? 'Jalons atteints' : 'Jalon atteint', lines: ach.map(a => `${a.title}${a.detail ? ` · ${a.detail}` : ''}`), badges: ach.map(a => ({ cat: a.cat, major: a.tier === 'major', title: a.title })) });
  // Ce qui a bien fonctionné : uniquement des faits de la semaine, jamais un reproche.
  const worked: string[] = []; let adaptedDone = 0, restsKept = 0;
  for (let i = 0; i < 7; i++) { const d = addDays(from, i), a = adapted(s, d); const ok = activitiesOn(s, d).some(x => countsFor(x, d)); if (ok && (a.reason || a.replaced)) adaptedDone++; if (a.type === 'rest' && !activitiesOn(s, d).some(x => !x.complementary && (x.effort ?? 0) >= 7)) restsKept++; }
  if (deload && success) worked.push('Tu as levé le pied comme prévu : c\'est pendant ces semaines que le corps assimile.');
  else if (planned && done === planned) worked.push(`Toutes les séances prévues sont faites (${done}/${planned}).`);
  else if (success) worked.push(`${done} séances prévues sur ${planned} : le rythme est là.`);
  if (adaptedDone) worked.push(`${adaptedDone} séance${adaptedDone > 1 ? 's' : ''} adaptée${adaptedDone > 1 ? 's' : ''} à ta récupération plutôt que forcée${adaptedDone > 1 ? 's' : ''}.`);
  if (optional) worked.push(`${optional} séance${optional > 1 ? 's' : ''} optionnelle${optional > 1 ? 's' : ''} en plus, sans que ce soit dû.`);
  if (restsKept >= 2) worked.push(`${restsKept} jours de repos respectés.`);
  if (worked.length) cards.push({ kind: 'worked', title: 'Ce qui a bien fonctionné', lines: worked });
  const cis = Array.from({ length: 7 }, (_, i) => s.checkins[addDays(from, i)]).filter(c => c && c.sleep && c.energy);
  if (cis.length >= 3) {
    const good = cis.filter(c => c!.sleep === 'bien' || c!.sleep === 'tres').length; const avgE = cis.reduce((t, c) => t + (c!.energy || 0), 0) / cis.length;
    cards.push({ kind: 'recovery', title: 'Ta récupération', lines: [`${cis.length} check-ins cette semaine.`, `${good} nuit${good > 1 ? 's' : ''} notée${good > 1 ? 's' : ''} bonne${good > 1 ? 's' : ''} ou très bonne${good > 1 ? 's' : ''}.`, `Énergie moyenne : ${avgE.toFixed(1).replace('.', ',')} sur 5.`] });
  }
  const nf = addDays(to, 1); const ph = phaseOf(w + 1); const next: string[] = [];
  for (let i = 0; i < 7; i++) { const d = addDays(nf, i), a = adapted(s, d); if (a.type === 'event' || (a.type === 'run' && a.run && a.run.kind !== 'facile') || (a.type !== 'rest' && a.mandatory && i === 2)) next.push(`${DAYS_SHORT[dow(d)]} · ${(a.replaced || a).title}`); }
  const nm = nextMilestone(s, to);
  if (w < s.program.weeks) cards.push({ kind: 'next', title: 'La semaine prochaine', lines: [`Phase ${ph.n} · ${ph.name}${DELOAD.includes(w + 1) ? ', semaine allégée' : ''}`, ...next, ...(nm ? [`Prochain objectif : ${nm.title.toLowerCase()} (${nm.progress!.label.toLowerCase()})`] : [])] });
  return { week: w, from, to, cards, success };
}
/** Bilans disponibles : semaines terminées, plus la semaine en cours à partir du dimanche 18 h. */
export function availableRecaps(s: AppState, now = new Date()): number[] {
  const cur = weekOf(s, iso(now)); const sundayEvening = dow(iso(now)) === 6 && now.getHours() >= 18;
  const last = Math.min(s.program.weeks, sundayEvening ? cur : cur - 1);
  return Array.from({ length: Math.max(0, last) }, (_, i) => last - i);
}
const iso = (d: Date) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
