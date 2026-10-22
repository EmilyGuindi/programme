import { achievementsFor, nextMilestone, unlocked, type Achievement } from './achievements';
import { adapted, doneOn, mandatoryStats, recovery, weekOf } from './coach';
import { daysBetween } from './dates';
import { programEnd } from './generator';
import { weekSuccess } from './journey';
import { nextEvent } from './race';
import type { AppState, ISODate, SportEvent } from './types';

/* ============================================================
   Élan : ce qui donne envie de revenir. Tout est calculé sur le programme en cours (jamais sur l'historique d'avant).
   ============================================================ */
export interface Momentum {
  week: number; weeks: number; daysLeft: number;
  /** Séances obligatoires du programme jusqu'à aujourd'hui. */ done: number; planned: number;
  /** Semaines réussies d'affilée (la semaine en cours n'est pas comptée). */ streak: number; bestStreak: number;
  next: Achievement | null; lastUnlocked: Achievement | null; event: SportEvent | null; eventIn: number | null;
}
export function momentum(s: AppState, d: ISODate, ach = achievementsFor(s, d)): Momentum {
  const P = s.program; const end = [programEnd(P), d].sort()[0];
  const st = P.start <= d ? mandatoryStats(s, P.start, end) : { done: 0, planned: 0 };
  const ok = weekSuccess(s, d).map(w => w.ok);
  let streak = 0; for (let i = ok.length - 1; i >= 0 && ok[i]; i--) streak++;
  let best = 0, c = 0; ok.forEach(x => { c = x ? c + 1 : 0; best = Math.max(best, c); });
  const ev = nextEvent(s, d, 120) || null;
  const got = unlocked(s, d, ach).sort((a, b) => b.date!.localeCompare(a.date!));
  return { week: Math.min(P.weeks, Math.max(1, weekOf(s, d))), weeks: P.weeks, daysLeft: Math.max(0, daysBetween(d, programEnd(P))), done: st.done, planned: st.planned,
    streak, bestStreak: best, next: nextMilestone(s, d, undefined, ach), lastUnlocked: got[0] || null, event: ev, eventIn: ev ? daysBetween(d, ev.date) : null };
}

/** Mot du coach sans réseau : une phrase vraie, tirée des données, qui change chaque jour. */
export function localWord(s: AppState, d: ISODate, m = momentum(s, d)): string {
  const a = adapted(s, d); const sh = a.replaced || a; const r = recovery(s, d); const done = doneOn(s, d);
  const lines: string[] = [];
  if (done) lines.push(m.streak >= 2 ? `Séance faite. ${m.streak} semaines réussies d'affilée : c'est exactement comme ça qu'on progresse.` : 'Séance faite. Chaque séance cochée compte dans ton programme.');
  if (m.eventIn != null && m.eventIn <= 21) lines.push(m.eventIn === 0 ? `C'est le jour J : ${m.event!.name}. Pars prudente, finis fort.` : `J-${m.eventIn} avant ${m.event!.name}. Ce qui compte maintenant : la régularité, pas l'exploit.`);
  if (m.next?.progress) lines.push(`Prochain jalon : « ${m.next.title} ». ${m.next.progress.label}.`);
  if (!done && r.level === 'rouge') lines.push('Ton corps demande de la récupération aujourd\'hui. Récupérer, c\'est aussi s\'entraîner.');
  if (!done && sh.type === 'box') lines.push(`${a.hyrox ? 'HYROX' : 'CrossFit'} aujourd'hui. Après le cours, dis-moi en un geste comment c'était.`);
  if (!done && sh.type === 'run') lines.push(`${sh.title} au programme. Le facile doit rester facile : c'est lui qui construit ta vitesse.`);
  if (m.planned) lines.push(`${m.done} séance${m.done > 1 ? 's' : ''} sur ${m.planned} faites depuis le début du programme. Semaine ${m.week} sur ${m.weeks}.`);
  if (!lines.length) lines.push('Jour calme. Une marche, une bonne nuit, et demain on repart.');
  const n = Math.floor(Date.parse(d) / 864e5);
  return done || (m.eventIn != null && m.eventIn <= 21) ? lines[0] : lines[n % lines.length];
}
