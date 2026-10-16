import { activitiesOn, adapted, countsFor, DELOAD, phaseOf, runInsight, weekOf, weekStart } from './coach';
import { addDays, DAYS_SHORT, dow } from './dates';
import { newRecords } from './records';
import type { AppState, ISODate } from './types';

export type RecapCard = { kind: 'numbers' | 'sessions' | 'highlight' | 'progress' | 'records' | 'recovery' | 'next'; title: string; lines: string[]; big?: string; bigLabel?: string };
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
      deload && success ? 'Une semaine allégée bien respectée, c\'est exactement ce qu\'il fallait.' : success ? 'Semaine réussie.' : planned ? 'Semaine incomplète : rien à rattraper, la suite s\'ajuste.' : ''].filter(Boolean) });
  if (sessions.length) cards.push({ kind: 'sessions', title: 'Tes séances', lines: sessions });
  const ev = s.events.find(e => e.date >= from && e.date <= to && e.result);
  const top = hard.sort((a, b) => b.e - a.e)[0];
  if (ev) cards.push({ kind: 'highlight', title: 'Ton moment fort', lines: [`${ev.name} : terminé.`] });
  else if (top && top.e >= 7) cards.push({ kind: 'highlight', title: 'Ton moment fort', lines: [`${top.t}, ressenti ${top.e}/10.`] });
  const ins = runInsight(s);
  if (!/Pas encore|pas encore/.test(ins)) cards.push({ kind: 'progress', title: 'Ce qui évolue', lines: [ins] });
  const rec = newRecords(s, from, to);
  if (rec.length) cards.push({ kind: 'records', title: rec.length > 1 ? 'Nouveaux records' : 'Nouveau record', lines: rec.map(r => `${r.label} : ${r.value}`) });
  const cis = Array.from({ length: 7 }, (_, i) => s.checkins[addDays(from, i)]).filter(c => c && c.sleep && c.energy);
  if (cis.length >= 3) {
    const good = cis.filter(c => c!.sleep === 'bien' || c!.sleep === 'tres').length; const avgE = cis.reduce((t, c) => t + (c!.energy || 0), 0) / cis.length;
    cards.push({ kind: 'recovery', title: 'Ta récupération', lines: [`${cis.length} check-ins cette semaine.`, `${good} nuit${good > 1 ? 's' : ''} notée${good > 1 ? 's' : ''} bonne${good > 1 ? 's' : ''} ou très bonne${good > 1 ? 's' : ''}.`, `Énergie moyenne : ${avgE.toFixed(1).replace('.', ',')} sur 5.`] });
  }
  const nf = addDays(to, 1); const ph = phaseOf(w + 1); const next: string[] = [];
  for (let i = 0; i < 7; i++) { const d = addDays(nf, i), a = adapted(s, d); if (a.type === 'event' || (a.type === 'run' && a.run && a.run.kind !== 'facile') || (a.type !== 'rest' && a.mandatory && i === 2)) next.push(`${DAYS_SHORT[dow(d)]} · ${(a.replaced || a).title}`); }
  if (w < s.program.weeks) cards.push({ kind: 'next', title: 'La semaine prochaine', lines: [`Phase ${ph.n} · ${ph.name}${DELOAD.includes(w + 1) ? ', semaine allégée' : ''}`, ...next] });
  return { week: w, from, to, cards, success };
}
/** Bilans disponibles : semaines terminées, plus la semaine en cours à partir du dimanche 18 h. */
export function availableRecaps(s: AppState, now = new Date()): number[] {
  const cur = weekOf(s, iso(now)); const sundayEvening = dow(iso(now)) === 6 && now.getHours() >= 18;
  const last = Math.min(s.program.weeks, sundayEvening ? cur : cur - 1);
  return Array.from({ length: Math.max(0, last) }, (_, i) => last - i);
}
const iso = (d: Date) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
