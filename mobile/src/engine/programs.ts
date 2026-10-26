import { adapted, committed, doneOn, mandatoryStats, phasesOf, programAt, withProgram } from './coach';
import { addDays, daysBetween, dow, fmtShort, mmss, uid } from './dates';
import { CYCLE1_SPEC, deloadWeeks, FOCUS_LABEL, generatePhases, HARD, keyRun, longRun, programEnd, SLOT_LABEL, weeklyRunMinutes } from './generator';
import { newRecords } from './records';
import type { AppState, ISODate, ProgramDef, ProgramSpec, ProgramStatus, ProgramSummary, RunFocus, Slot } from './types';

/* ============================================================
   Programmes successifs : brouillons, validation, activation confirmée, bilans conservés.
   Rien n'est jamais activé sans confirmation explicite, et l'historique n'est jamais effacé.
   ============================================================ */

export const STATUS_LABEL: Record<ProgramStatus, string> = { draft: 'Brouillon', planned: 'À venir', active: 'En cours', done: 'Terminé', archived: 'Archivé' };
/** Nom affiché (les anciens noms utilisaient « · » et des abréviations). */
export const nameOf = (p: ProgramDef) => p.name.replace(/\s·\s/g, ', ').replace('Oct → Fév', 'octobre à février');
export const allPrograms = (s: AppState): ProgramDef[] => [s.program, ...(s.programs || [])];
export const findProgram = (s: AppState, id: string) => allPrograms(s).find(p => p.id === id) || null;
export const specOf = (p: ProgramDef): ProgramSpec => p.spec || CYCLE1_SPEC;
/** Statut affiché : brouillons et archives tels quels ; les autres selon les dates. */
export function statusOf(p: ProgramDef, today: ISODate): ProgramStatus {
  if (p.status === 'draft' || p.status === 'archived') return p.status;
  return today < p.start ? 'planned' : today > programEnd(p) ? 'done' : 'active';
}
const mondayOnOrAfter = (d: ISODate) => addDays(d, (7 - dow(d)) % 7);
export const nextMonday = (d: ISODate) => addDays(d, 7 - dow(d));
/** Premier lundi libre : après la fin du dernier programme engagé, ou le lundi suivant si tout est terminé. */
export function suggestedStart(s: AppState, today: ISODate): ISODate {
  const lastEnd = committed(s).map(programEnd).sort().pop() || today;
  return lastEnd >= today ? mondayOnOrAfter(addDays(lastEnd, 1)) : nextMonday(today);
}

/* ---------- Bilan d'un programme ---------- */
const pace = (a: { durationMin?: number | null; distanceKm?: number | null }) => (a.durationMin! * 60) / a.distanceKm!;
export function summarize(s0: AppState, p: ProgramDef, today: ISODate): ProgramSummary {
  const s = withProgram(s0, p); const from = p.start; const to = [programEnd(p), today].sort()[0];
  const st = mandatoryStats(s, from, to);
  const runs = s.activities.filter(a => a.date >= from && a.date <= to && (a.type === 'running' || a.type === 'course') && !a.complementary);
  const easy = runs.filter(a => a.distanceKm && a.durationMin && (a.kind || 'facile') === 'facile' && pace(a) > 240 && pace(a) < 600);
  const ws = s.measurements.filter(m => m.date >= from && m.date <= to && m.weight).sort((a, b) => a.date.localeCompare(b.date));
  return { planned: st.planned, done: st.done, rate: st.planned ? st.done / st.planned : 0, km: Math.round(runs.reduce((t, a) => t + (a.distanceKm || 0), 0) * 10) / 10, runs: runs.length,
    records: newRecords(s, from, to).length, weightDelta: ws.length >= 2 ? Math.round((ws[ws.length - 1].weight - ws[0].weight) * 10) / 10 : null,
    pace: { first: easy.length >= 2 ? pace(easy[0]) : null, last: easy.length >= 2 ? pace(easy[easy.length - 1]) : null }, at: Date.now() };
}

/** Étape 1 du constructeur : ce que le cycle précédent dit de toi. Des constats tirés des données, pas des suppositions. */
export interface CycleAnalysis { program: ProgramDef; summary: ProgramSummary; byDay: { dow: number; planned: number; done: number }[]; findings: string[]; weakDay: number | null }
export function analyzeCycle(s: AppState, p: ProgramDef, today: ISODate): CycleAnalysis {
  const sum = summarize(s, p, today); const sp = withProgram(s, p);
  const byDay = Array.from({ length: 7 }, (_, i) => ({ dow: i, planned: 0, done: 0 }));
  for (let d = p.start; d <= [programEnd(p), addDays(today, -1)].sort()[0]; d = addDays(d, 1)) { const a = adapted(sp, d); if (a.mandatory && !a.skipped) { byDay[dow(d)].planned++; if (doneOn(sp, d)) byDay[dow(d)].done++; } }
  const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const f: string[] = [];
  if (sum.planned) f.push(`${sum.done} séance${sum.done > 1 ? 's' : ''} prévue${sum.done > 1 ? 's' : ''} réalisée${sum.done > 1 ? 's' : ''} sur ${sum.planned} (${Math.round(sum.rate * 100)} %).`);
  else f.push('Pas encore assez de séances passées pour un bilan chiffré.');
  if (sum.runs) f.push(`${sum.runs} sorties de course, ${String(sum.km).replace('.', ',')} km au total.`);
  if (sum.pace.first && sum.pace.last) { const dlt = sum.pace.last - sum.pace.first; f.push(Math.abs(dlt) < 5 ? `Allure facile stable autour de ${mmss(sum.pace.last)} /km.` : dlt < 0 ? `Allure facile plus rapide : ${mmss(sum.pace.first)} → ${mmss(sum.pace.last)} /km.` : `Allure facile plus lente en fin de cycle (${mmss(sum.pace.first)} → ${mmss(sum.pace.last)} /km) : fatigue, chaleur ou dénivelé possibles.`); }
  if (sum.records) f.push(`${sum.records} record${sum.records > 1 ? 's' : ''} battu${sum.records > 1 ? 's' : ''} pendant le cycle.`);
  if (sum.weightDelta != null) f.push(`Poids : ${sum.weightDelta > 0 ? '+' : ''}${String(sum.weightDelta).replace('.', ',')} kg sur la période.`);
  const cand = byDay.filter(x => x.planned >= 3).sort((a, b) => a.done / a.planned - b.done / b.planned)[0];
  const weakDay = cand && cand.done / cand.planned < 0.6 ? cand.dow : null;
  if (weakDay != null) f.push(`Le ${DAYS[weakDay]} est le jour le moins suivi (${Math.round((cand.done / cand.planned) * 100)} %) : c'est peut-être le jour à changer.`);
  return { program: p, summary: sum, byDay, findings: f, weakDay };
}

/* ---------- Brouillon ---------- */
export interface DraftInput { name?: string; start: ISODate; /** Fin précise (incluse) : prioritaire sur weeks. */ end?: ISODate | null; weeks: number; spec: ProgramSpec; goal?: string; basedOn?: string }
export function makeDraft(x: DraftInput): ProgramDef {
  const now = Date.now(); const end = x.end && x.end > x.start ? x.end : null;
  const weeks = end ? weeksBetween(x.start, end) : Math.round(x.weeks);
  return { id: 'p-' + uid(), name: x.name?.trim() || `Programme du ${fmtShort(x.start)}`, start: x.start, ...(end ? { end } : {}), weeks, status: 'draft', template: 'custom',
    spec: { ...x.spec, days: [...x.spec.days] }, phases: generatePhases(weeks, x.spec.focus), goal: x.goal || FOCUS_LABEL[x.spec.focus], basedOn: x.basedOn, createdAt: now, updatedAt: now };
}
/** Nombre de semaines (entamées) entre deux dates incluses. */
export const weeksBetween = (start: ISODate, end: ISODate) => Math.ceil((daysBetween(start, end) + 1) / 7);
/** Durée suggérée : jusqu'à la compétition objectif (plus une semaine de bilan), sinon 12 semaines. Jamais 20 par défaut. */
export function suggestWeeks(start: ISODate, eventDate?: ISODate | null): number {
  if (!eventDate || eventDate <= start) return 12;
  return Math.max(4, Math.min(24, Math.ceil((daysBetween(start, eventDate) + 1) / 7) + 1));
}

/* ---------- Moteur de validation : les règles de sécurité appartiennent à BYYND ---------- */
export type Severity = 'block' | 'warn' | 'info';
export interface Issue { code: string; severity: Severity; text: string }
export function validateProgram(s: AppState, p: ProgramDef, today: ISODate): Issue[] {
  const out: Issue[] = []; const add = (code: string, severity: Severity, text: string) => out.push({ code, severity, text });
  const sp = specOf(p); const days = sp.days;
  if (!Number.isInteger(p.weeks) || p.weeks < (p.end ? 3 : 4) || p.weeks > 30) add('weeks', 'block', 'La durée doit être comprise entre 4 et 30 semaines.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.start)) add('start-date', 'block', 'Date de début invalide.');
  else if (p.start < today) add('start-past', 'block', 'La date de début ne peut pas être passée : un programme ne réécrit pas l\'historique.');
  else if (dow(p.start) !== 0) add('start-day', 'info', `Ton programme démarre un ${['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][dow(p.start)]} : ses semaines vont de ce jour-là au suivant, la semaine type reste calée sur les jours de la semaine.`);
  if (p.end && (p.end <= p.start || daysBetween(p.start, p.end) + 1 < 21)) add('end', 'block', 'La date de fin doit laisser au moins 3 semaines de programme.');
  if (!Array.isArray(days) || days.length !== 7 || days.some(d => !(d in SLOT_LABEL))) { add('days', 'block', 'La semaine type doit décrire les 7 jours.'); return out; }
  const rest = days.filter(d => d === 'rest' || d === 'recup').length;
  if (rest < 1) add('rest', 'block', 'Au moins un jour de repos ou de récupération par semaine.');
  const hard = days.map(d => HARD.includes(d) || d === 'long');
  for (let i = 0; i < 7; i++) if (hard[i] && hard[(i + 1) % 7] && hard[(i + 2) % 7]) { add('hard-3', 'warn', 'Trois séances exigeantes d\'affilée : la récupération risque de manquer.'); break; }
  if (days.filter(d => d === 'run').length > 2) add('quality', 'warn', 'Plus de deux séances de course de qualité par semaine : une seule suffit pour progresser sans se blesser.');
  if (days.filter(d => d !== 'rest' && d !== 'recup').length > 6) add('volume', 'block', 'Sept jours d\'entraînement sur sept : garde au moins un jour sans charge.');
  const runs = days.filter(d => d === 'run' || d === 'long').length;
  if (!runs && sp.focus !== 'maintien') add('no-run', 'warn', 'Objectif course sans aucune séance de course dans la semaine.');
  if (p.weeks > 6 && !sp.deloadEvery) add('deload', 'warn', 'Aucune semaine allégée sur plus de 6 semaines : prévois-en une toutes les 3 à 5 semaines.');
  if (sp.deloadEvery && (sp.deloadEvery < 3 || sp.deloadEvery > 6)) add('deload-range', 'warn', 'Une semaine allégée toutes les 3 à 6 semaines est le repère habituel.');
  // progression du volume de course : pas plus de 10 % d'une semaine normale à la suivante
  let prev = 0; const dl = deloadWeeks(p);
  for (let w = 1; w <= p.weeks; w++) { const m = weeklyRunMinutes(p, w); if (prev && !dl.includes(w) && !dl.includes(w - 1) && m > prev * 1.1 + 5) { add('ramp', 'warn', `Volume de course en hausse de plus de 10 % en semaine ${w}.`); break; } if (!dl.includes(w)) prev = Math.max(prev, m); }
  const end = programEnd(p);
  for (const o of committed(s)) {
    if (o.id === p.id) continue;
    const oEnd = programEnd(o);
    if (o.start >= p.start && o.start <= end) add('overlap', 'block', `Chevauche « ${nameOf(o)} » (à partir du ${fmtShort(o.start)}).`);
    else if (o.start < p.start && oEnd >= p.start) add('truncate', 'info', `« ${nameOf(o)} » se terminera le ${fmtShort(addDays(p.start, -1))} au lieu du ${fmtShort(oEnd)}.`);
  }
  const evs = s.events.filter(e => e.status !== 'annulé' && e.date >= p.start && e.date <= end);
  if (evs.length) add('events', 'info', `Compétitions prises en compte : ${evs.map(e => `${e.name} (${fmtShort(e.date)})`).join(', ')}. Les séances autour sont allégées automatiquement.`);
  const goal = sp.goalEventId ? s.events.find(e => e.id === sp.goalEventId) : null;
  if (goal && (goal.date < p.start || goal.date > end)) add('goal-out', 'warn', `${goal.name} n'est pas dans les dates du programme.`);
  return out;
}
export const blocking = (issues: Issue[]) => issues.some(i => i.severity === 'block');

/* ---------- Aperçu et comparaison ---------- */
export function weekPreview(p: ProgramDef, w: number): { dow: number; slot: Slot; label: string; detail: string }[] {
  return specOf(p).days.map((sl, i) => ({ dow: i, slot: sl, label: SLOT_LABEL[sl], detail: sl === 'run' ? keyRun(p, w).title : sl === 'long' ? longRun(p, w).title : '' }));
}
export interface CompareRow { label: string; a: string; b: string }
export function compare(a: ProgramDef, b: ProgramDef): CompareRow[] {
  const sa = specOf(a), sb = specOf(b);
  const n = (sp: ProgramSpec, sl: Slot[]) => String(sp.days.filter(d => sl.includes(d)).length);
  const rows: CompareRow[] = [
    { label: 'Durée', a: `${a.weeks} semaines`, b: `${b.weeks} semaines` },
    { label: 'Objectif', a: FOCUS_LABEL[sa.focus as RunFocus], b: FOCUS_LABEL[sb.focus as RunFocus] },
    { label: 'Course / semaine', a: n(sa, ['run', 'long']), b: n(sb, ['run', 'long']) },
    { label: 'CrossFit / semaine', a: n(sa, ['crossfit']), b: n(sb, ['crossfit']) },
    { label: 'HYROX / semaine', a: n(sa, ['hyrox']), b: n(sb, ['hyrox']) },
    { label: 'Renforcement', a: n(sa, ['renfo']), b: n(sb, ['renfo']) },
    { label: 'Repos', a: n(sa, ['rest', 'recup']), b: n(sb, ['rest', 'recup']) },
    { label: 'Semaines allégées', a: deloadWeeks(a).length ? deloadWeeks(a).map(w => `S${w}`).join(', ') : 'aucune', b: deloadWeeks(b).length ? deloadWeeks(b).map(w => `S${w}`).join(', ') : 'aucune' },
    { label: 'Phases', a: phasesOf(a).map(x => x.name).join(', '), b: phasesOf(b).map(x => x.name).join(', ') },
  ];
  return rows;
}

/* ---------- Cycle de vie (mutations, toujours après confirmation dans l'interface) ---------- */
export function saveDraft(s: AppState, p: ProgramDef) {
  const list = (s.programs = s.programs || []); const i = list.findIndex(x => x.id === p.id);
  const next = { ...p, status: 'draft' as const, updatedAt: Date.now() }; if (i >= 0) list[i] = next; else list.push(next);
}
export function deleteDraft(s: AppState, id: string) { s.programs = (s.programs || []).filter(p => !(p.id === id && p.status === 'draft')); }
export function archive(s: AppState, id: string) { const p = (s.programs || []).find(x => x.id === id); if (p && (p.status === 'draft' || p.status === 'done')) { p.status = 'archived'; p.updatedAt = Date.now(); } }
/** Ce que l'activation va changer, à montrer avant de confirmer. */
export function activationConsequences(s: AppState, p: ProgramDef, today: ISODate): string[] {
  const out = [`À partir du ${fmtShort(p.start)}, Aujourd'hui et Programme suivront « ${nameOf(p)} » pendant ${p.weeks} semaines.`];
  const cur = programAt(s, addDays(p.start, -1));
  if (cur && programEnd(cur) >= p.start) out.push(`« ${nameOf(cur)} » se terminera le ${fmtShort(addDays(p.start, -1))}. Son historique et son bilan sont conservés.`);
  else out.push('Les séances déjà passées, coches, charges et activités ne changent pas.');
  out.push('Tes accomplissements et records sont conservés : rien n\'est remis à zéro.');
  if (p.start > today) out.push('Jusque-là, rien ne change dans ton planning.');
  return out;
}
/** Activation confirmée : le programme devient « à venir » (ou en cours à sa date). Le programme qu'il remplace est clos, pas effacé. */
export function activate(s: AppState, id: string, today: ISODate): { ok: boolean; issues: Issue[] } {
  const p = (s.programs || []).find(x => x.id === id); if (!p) return { ok: false, issues: [{ code: 'missing', severity: 'block', text: 'Programme introuvable.' }] };
  const issues = validateProgram(s, p, today); if (blocking(issues)) return { ok: false, issues };
  for (const o of committed(s)) if (o.id !== p.id && o.start < p.start && programEnd(o) >= p.start) { o.end = addDays(p.start, -1); o.updatedAt = Date.now(); }
  p.status = 'planned'; p.activatedAt = Date.now(); p.updatedAt = Date.now();
  rollover(s, today);
  return { ok: true, issues };
}
/** Passage de relais à la date de début : le programme en cours devient le suivant, l'ancien rejoint l'historique avec son bilan. */
export function rollover(s: AppState, today: ISODate): boolean {
  const list = (s.programs = s.programs || []);
  const due = list.filter(p => p.status === 'planned' && p.start <= today).sort((a, b) => b.start.localeCompare(a.start))[0];
  if (!due || due.start <= s.program.start) return false;
  const old = s.program; old.status = 'done'; old.summary = summarize(s, old, today); old.updatedAt = Date.now();
  s.programs = [...list.filter(p => p.id !== due.id), old];
  s.program = { ...due, status: 'active', updatedAt: Date.now() };
  return true;
}

/* ---------- Entrées non fiables (coach, import) → description validée ---------- */
const SLOTS: Slot[] = ['crossfit', 'hyrox', 'run', 'long', 'renfo', 'recup', 'rest'];
const FOCI: RunFocus[] = ['10k', '5k', 'endurance', 'maintien'];
/** Convertit une proposition externe en ProgramSpec, champ par champ. Tout ce qui n'est pas reconnu est ignoré, jamais exécuté. */
export function parseSpec(raw: unknown, fallback: ProgramSpec = CYCLE1_SPEC): ProgramSpec {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const days = Array.isArray(r.days) && r.days.length === 7 && r.days.every(d => SLOTS.includes(d as Slot)) ? (r.days as Slot[]) : fallback.days;
  const focus = FOCI.includes(r.focus as RunFocus) ? (r.focus as RunFocus) : fallback.focus;
  const de = Number(r.deloadEvery); const deloadEvery = Number.isInteger(de) && de >= 0 && de <= 8 ? de : fallback.deloadEvery || 4;
  return { days: [...days], focus, deloadEvery, tests: typeof r.tests === 'boolean' ? r.tests : fallback.tests !== false,
    goalEventId: typeof r.goalEventId === 'string' ? r.goalEventId.slice(0, 40) : fallback.goalEventId ?? null,
    constraints: typeof r.constraints === 'string' ? r.constraints.slice(0, 400) : fallback.constraints };
}
/** Programme de référence pour le suivant : le dernier engagé déjà commencé. */
export function previousProgram(s: AppState, today: ISODate): ProgramDef {
  const started = committed(s).filter(p => p.start <= today);
  return started[started.length - 1] || s.program;
}
