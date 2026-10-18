import { adapted, planFor } from '@/engine/coach';
import { addDays, dow, fmtDay, fmtShort, mmss } from '@/engine/dates';
import { CYCLE1_SPEC } from '@/engine/generator';
import { previousProgram, specOf } from '@/engine/programs';
import type { CoachCard, ISODate, ProgramSpec, RunFocus, Slot } from '@/engine/types';
import type { CoachContext, CoachProvider, CoachReply } from './provider';

/* ============================================================
   Coach BYYND local : compréhension par règles (aucun modèle génératif, aucun envoi de données).
   Il lit uniquement la demande tapée par l'utilisatrice. Les titres d'activités, imports ou anciens messages
   ne sont jamais interprétés comme des consignes : ils ne servent qu'à l'affichage.
   ============================================================ */

export const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();
const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const NUM: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6 };
const id = () => Math.random().toString(36).slice(2, 9);
export const SUGGESTIONS = ['Je suis fatiguée aujourd\'hui, adapte ma séance', 'La semaine prochaine, mets mon running lundi plutôt que mercredi', 'Pourquoi je ne progresse plus en allure ?', 'Prépare-moi pour mon prochain 10 km', 'Construis mon programme après celui de février', 'Regarde mes trois dernières sorties et dis-moi ce qui change'];

/** Jours cités, dans l'ordre du texte. */
function daysIn(t: string): { dow: number; at: number }[] { const out: { dow: number; at: number }[] = []; DAYS.forEach((d, i) => { let k = t.indexOf(d); while (k >= 0) { out.push({ dow: i, at: k }); k = t.indexOf(d, k + 1); } }); return out.sort((a, b) => a.at - b.at); }
function typeIn(t: string): 'run' | 'renfo' | 'box' | null { if (/running|course a pied|footing|\brun\b|sortie|fractionne|seuil/.test(t)) return 'run'; if (/renfo|muscu|force/.test(t)) return 'renfo'; if (/crossfit|hyrox/.test(t)) return 'box'; return null; }
/** Semaine visée : lundi de la semaine. */
function weekOfText(t: string, today: ISODate): ISODate { const mon = addDays(today, -dow(today)); return /semaine prochaine|la semaine d apres/.test(t) ? addDays(mon, 7) : mon; }

function reschedule(t: string, ctx: CoachContext): CoachReply | null {
  if (!/(mets|mettre|deplace|deplacer|bouge|decale|decaler|passe|passer|change)/.test(t)) return null;
  const ds = daysIn(t); if (ds.length < 2 && !/demain/.test(t)) return null;
  let fromDow: number, toDow: number;
  const pq = t.search(/plutot que|au lieu de|au lieu du/);
  if (pq >= 0) { const after = ds.find(d => d.at > pq); const other = ds.find(d => d !== after); if (!after || !other) return null; fromDow = after.dow; toDow = other.dow; }
  else if (ds.length >= 2) { fromDow = ds[0].dow; toDow = ds[1].dow; } else return null;
  const mon = weekOfText(t, ctx.today); const type = typeIn(t);
  let from = addDays(mon, fromDow); let to = addDays(mon, toDow);
  const p = planFor(ctx.state as any, from);
  if (type && p.type !== type) { // la séance citée n'est pas ce jour-là : on la cherche dans la semaine
    const found = Array.from({ length: 7 }, (_, i) => addDays(mon, i)).find(d => planFor(ctx.state as any, d).type === type);
    if (found) from = found;
  }
  if (to < from && toDow < fromDow && to < ctx.today) to = addDays(to, 7);
  const prev = ctx.read({ name: 'preview_workout_reschedule', args: { from, to } }); if (prev.error) return { text: prev.error, cards: [] };
  const card = ctx.propose({ name: 'apply_workout_reschedule', args: { from, to } });
  if ('error' in card) return { text: card.error, cards: [] };
  const v = prev.data; const intro = v.verdict === 'ok' ? 'C\'est cohérent.' : v.verdict === 'warn' ? 'Possible, avec une réserve.' : 'Pas ce jour-là.';
  const week: CoachCard = { kind: 'week', id: id(), title: 'Ta semaine après le déplacement', days: Array.from({ length: 7 }, (_, i) => { const d = addDays(mon, i); const pl = d === to ? planFor(ctx.state as any, from) : d === from ? (v.swapWith ? planFor(ctx.state as any, to) : { title: 'Repos' }) : planFor(ctx.state as any, d); return { date: d, label: DAYS[i].slice(0, 3), title: pl.title, changed: d === to || d === from }; }) };
  return { text: `${intro} ${planFor(ctx.state as any, from).title} du ${fmtDay(from)} au ${fmtDay(to)}.${v.alternatives?.length && v.verdict !== 'ok' ? ` Sans conflit : ${v.alternatives.map((a: any) => a.label).slice(0, 3).join(', ')}.` : ''}`, cards: v.verdict === 'block' ? [week] : [card, week] };
}

function fatigue(t: string, ctx: CoachContext): CoachReply | null {
  if (!/(fatigu|creve|epuis|pas en forme|mal dormi|courbatu|videe|naze|malade|adapte)/.test(t)) return null;
  const d = /demain/.test(t) ? addDays(ctx.today, 1) : ctx.today;
  const r = ctx.read({ name: 'get_recovery_summary', args: { date: d } });
  const p = adapted(ctx.state as any, d);
  if (p.type === 'rest') return { text: `${fmtDay(d)} est déjà un jour de repos. Marche tranquille et sommeil : c'est le meilleur plan.`, cards: [] };
  const sick = /malade|fievre/.test(t); const level = r.data?.level;
  const kind = sick || level === 'rouge' ? 'rest' : level === 'orange' || /tres|vraiment|epuis|creve/.test(t) ? 'reduced' : 'easy';
  const card = ctx.propose({ name: 'adapt_today', args: { date: d, kind, reason: sick ? 'Malade : repos' : 'Fatigue signalée au coach' } });
  if ('error' in card) return { text: card.error, cards: [] };
  const why = r.error ? 'Je n\'ai pas accès à tes check-ins : je me fie à ce que tu me dis.' : level === 'inconnu' ? 'Pas de check-in aujourd\'hui : un check-in rendrait l\'avis plus précis.' : `Récupération : ${level}. ${(r.data?.reasons || []).join(' ')}`;
  return { text: `Prévu : ${p.title}. ${kind === 'rest' ? 'Je te propose de ne pas forcer : repos ou récupération active.' : kind === 'reduced' ? 'Je te propose une version réduite.' : 'Je te propose de garder la séance en version facile.'} ${why}`, cards: [card], suggestions: ['Pourquoi je ne progresse plus en allure ?'] };
}

function paceWhy(t: string, ctx: CoachContext): CoachReply | null {
  if (!/(progress|allure|vitesse|lent|stagn)/.test(t) || /prepare|programme|10 ?km pour|garder/.test(t)) return null;
  const r = ctx.read({ name: 'get_running_progress', args: {} }); if (r.error) return { text: r.error, cards: [] };
  const d = r.data; const items: string[] = [];
  if (d.easyRuns < 4) return { text: `Je n'ai que ${d.easyRuns} footing${d.easyRuns > 1 ? 's' : ''} facile${d.easyRuns > 1 ? 's' : ''} exploitable${d.easyRuns > 1 ? 's' : ''} (distance et durée). Il en faut au moins 4 pour parler de tendance.`, cards: [] };
  const rec = d.recent; const avg = Math.round(rec.reduce((s: number, x: any) => s + x.pace, 0) / rec.length);
  items.push(`Allure facile récente : ${mmss(avg)} /km en moyenne sur ${rec.length} sorties${d.firstAvg ? `, contre ${mmss(d.firstAvg)} au début` : ''}.`);
  const hr = rec.filter((x: any) => x.hr); if (hr.length >= 3) items.push(`Fréquence cardiaque moyenne : ${Math.round(hr.reduce((s: number, x: any) => s + x.hr, 0) / hr.length)} bpm. À allure égale, une FC qui baisse est un progrès, même si le chrono ne bouge pas.`);
  const elev = rec.filter((x: any) => (x.elev || 0) / (x.km || 1) > 15); if (elev.length) items.push(`${elev.length} sortie${elev.length > 1 ? 's' : ''} vallonnée${elev.length > 1 ? 's' : ''} : le dénivelé ralentit l'allure sans que la forme baisse.`);
  const hard = rec.filter((x: any) => (x.effort || 0) >= 7); if (hard.length >= 2) items.push('Plusieurs footings ressentis durs : ils sont peut-être trop rapides pour faire progresser l\'endurance.');
  items.push('Le footing facile n\'est pas fait pour aller plus vite : la vitesse se gagne sur les séances de qualité et se mesure sur les tests et les courses.');
  const flat = d.firstAvg && Math.abs(avg - d.firstAvg) < 8;
  return { text: flat ? 'Ton allure facile est stable. Ce n\'est pas forcément un plateau : voici ce que montrent tes données.' : avg < (d.firstAvg || avg) ? 'Ton allure facile s\'améliore. Voici le détail.' : 'Ton allure facile a ralenti. Voici des pistes tirées de tes données, pas des certitudes.', cards: [{ kind: 'facts', id: id(), title: 'Ce que disent tes sorties', items }] };
}

function lastRuns(t: string, ctx: CoachContext): CoachReply | null {
  if (!/(dernier|derniere)s? (sortie|run|footing|course)/.test(t)) return null;
  const n = Object.entries(NUM).find(([w]) => new RegExp(`\\b${w}\\b (dernier|derniere)`).test(t))?.[1] || 3;
  const r = ctx.read({ name: 'get_training_history', args: { days: 120, type: 'running', last: n } }); if (r.error) return { text: r.error, cards: [] };
  const xs: any[] = r.data; if (!xs.length) return { text: 'Aucune sortie de course enregistrée pour l\'instant.', cards: [] };
  const rows = xs.map(x => [fmtShort(x.date), x.km ? `${String(Math.round(x.km * 10) / 10).replace('.', ',')} km` : '—', x.pace ? `${mmss(x.pace)}` : '—', x.hr ? `${x.hr}` : '—', x.effort != null ? `${x.effort}/10` : '—']);
  const paced = xs.filter(x => x.pace); const notes: string[] = [];
  if (paced.length >= 2) { const a = paced[paced.length - 1], b = paced[0]; const dl = b.pace - a.pace; notes.push(Math.abs(dl) < 6 ? 'Allure stable d\'une sortie à l\'autre.' : dl < 0 ? `La plus récente est plus rapide de ${mmss(-dl)} /km que la plus ancienne.` : `La plus récente est plus lente de ${mmss(dl)} /km que la plus ancienne.`); }
  const hrs = xs.filter(x => x.hr && x.pace); if (hrs.length >= 2 && hrs[0].hr < hrs[hrs.length - 1].hr && hrs[0].pace <= hrs[hrs.length - 1].pace) notes.push('FC plus basse pour une allure égale ou meilleure : bon signe d\'endurance.');
  if (xs.some(x => (x.elev || 0) > 80)) notes.push('Dénivelé différent selon les sorties : compare les allures avec prudence.');
  if (xs.length < n) notes.push(`Seulement ${xs.length} sortie${xs.length > 1 ? 's' : ''} sur les 120 derniers jours.`);
  return { text: notes.length ? notes.join(' ') : 'Voici tes dernières sorties.', cards: [{ kind: 'compare', id: id(), title: `${xs.length} dernière${xs.length > 1 ? 's' : ''} sortie${xs.length > 1 ? 's' : ''}`, head: ['Date', 'Distance', 'Allure', 'FC', 'Effort'], rows }] };
}

/** Semaine type à partir de contraintes chiffrées (« deux CrossFit, un HYROX… »). Placement : séances dures espacées, sortie longue le week-end. */
export function buildDays(counts: Partial<Record<Slot, number>>): Slot[] {
  const days: Slot[] = Array(7).fill('rest'); const PREF: Record<string, number[]> = { crossfit: [1, 3, 0, 4], hyrox: [5, 4], run: [2, 0, 4], long: [6, 5], renfo: [6, 4, 0] };
  for (const sl of ['crossfit', 'hyrox', 'run', 'long', 'renfo'] as Slot[]) for (let k = 0; k < (counts[sl] || 0); k++) { const d = [...PREF[sl], 0, 1, 2, 3, 4, 5, 6].find(x => days[x] === 'rest'); if (d != null && days.filter(x => x === 'rest').length > 1) days[d] = sl; }
  return days;
}
function composition(t: string): Partial<ProgramSpec> | null {
  const c: Partial<Record<Slot, number>> = {}; let found = false;
  const grab = (re: string, sl: Slot) => { const m = t.match(new RegExp(`(\\b(?:un|une|deux|trois|quatre|[1-6])\\b) (?:seance(?:s)? de |cours (?:de )?)?${re}`)); if (m) { c[sl] = NUM[m[1]]; found = true; } };
  grab('crossfit', 'crossfit'); grab('hyrox', 'hyrox'); grab('(?:renfo|renforcement|muscu)', 'renfo'); grab('(?:sortie|run|footing|course)s?', 'run');
  if (!found) return null;
  const wantsRun = /running|course|10 ?km|5 ?km|courir/.test(t);
  if (c.run && c.run >= 2) { c.long = 1; c.run = c.run - 1; } else if (wantsRun) { c.run = c.run || 1; c.long = 1; }
  const focus: RunFocus = /5 ?km/.test(t) ? '5k' : /longtemps|endurance|semi|marathon/.test(t) ? 'endurance' : wantsRun ? '10k' : 'maintien';
  return { days: buildDays(c), focus };
}

function program(t: string, ctx: CoachContext): CoachReply | null {
  const prep = /prepare|preparer|vise|objectif/.test(t) && /(\d+) ?km|semi|marathon|course|competition/.test(t);
  const next = /(programme|cycle).*(apres|suivant|prochain)|(prochain|nouveau) (programme|cycle)|construis|construire|cree|creer/.test(t) && /programme|cycle/.test(t);
  const comp = /garder|garde|je veux|avec/.test(t) ? composition(t) : null;
  if (!prep && !next && !comp) return null;
  const prev = previousProgram(ctx.state as any, ctx.today); const base = specOf(prev) || CYCLE1_SPEC; const spec: Partial<ProgramSpec> = { ...base, deloadEvery: base.deloadEvery || 4, ...(comp || {}) };
  let lead = '';
  if (prep) {
    const km = Number(t.match(/(\d+) ?km/)?.[1]) || (/semi/.test(t) ? 21 : /marathon/.test(t) ? 42 : 10);
    const ev = ctx.read({ name: 'get_upcoming_events', args: { days: 365 } });
    const goal = (ev.data || []).find((e: any) => e.type === 'course' && e.km && Math.abs(e.km - km) <= 1.5 && e.date > ctx.today);
    spec.focus = km <= 6 ? '5k' : km <= 12 ? '10k' : 'endurance';
    if (goal) { spec.goalEventId = goal.id; lead = `Objectif : ${goal.name}, le ${fmtShort(goal.date)}. `; }
    else lead = `Je ne vois pas de ${km} km dans tes compétitions à venir : ajoute-le pour caler l'affûtage. En attendant, voici un programme ${km <= 6 ? '5 km' : '10 km'} générique. `;
  }
  const card = ctx.propose({ name: 'create_program_draft', args: { spec } }); if ('error' in card) return { text: card.error, cards: [] };
  const ok = card.kind === 'program' && !card.issues.some(i => i.severity === 'block');
  return { text: `${lead}${comp ? 'Semaine type construite à partir de tes contraintes. ' : `Je pars de « ${prev.name.replace(/\s·\s/g, ', ')} » et je garde ce qui fonctionne. `}${ok ? 'Rien n\'est activé : enregistre le brouillon, modifie-le ou refuse-le.' : 'Les règles BYYND bloquent ce brouillon : modifie-le avant de l\'enregistrer.'}`, cards: [card] };
}

function week(t: string, ctx: CoachContext): CoachReply | null {
  if (!/(ma semaine|planning|programme de la semaine|cette semaine|semaine prochaine)/.test(t)) return null;
  const mon = weekOfText(t, ctx.today);
  return { text: 'Voici ta semaine.', cards: [{ kind: 'week', id: id(), title: `Semaine du ${fmtShort(mon)}`, days: Array.from({ length: 7 }, (_, i) => { const d = addDays(mon, i); return { date: d, label: DAYS[i].slice(0, 3), title: adapted(ctx.state as any, d).title }; }) }] };
}
function records(t: string, ctx: CoachContext): CoachReply | null {
  if (!/record/.test(t)) return null;
  const r = ctx.read({ name: 'get_personal_records', args: {} }); if (r.error) return { text: r.error, cards: [] };
  return { text: r.data.length ? 'Tes records actuels.' : 'Pas encore de record mesuré.', cards: r.data.length ? [{ kind: 'facts', id: id(), title: 'Records', items: r.data.map((x: any) => `${x.label} : ${x.value}, le ${fmtShort(x.date)}`) }] : [] };
}

export const localProvider: CoachProvider = {
  id: 'local', name: 'Coach BYYND',
  status: () => ({ available: true, label: 'Actif', detail: 'Règles BYYND appliquées sur ton téléphone. Aucune donnée envoyée à un service d\'IA.' }),
  async respond(input, ctx) {
    const t = norm(input).slice(0, 500);
    for (const f of [reschedule, fatigue, lastRuns, program, paceWhy, records, week]) { const r = f(t, ctx); if (r) return r; }
    return { text: 'Je comprends les demandes sur ta séance du jour, tes déplacements de séances, ta progression en course, tes dernières sorties, tes records et ton prochain programme. Essaie une des suggestions.', cards: [], suggestions: SUGGESTIONS.slice(0, 4) };
  },
};
