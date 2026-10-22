import { adapted, committed, doneOn, phaseOf, planFor, recovery, runsList, weekOf, ZONE_NAME, zoneText } from './coach';
import { addDays, dow, fmtDay, fmtShort, mmss } from './dates';
import { FOCUS_LABEL, phasesFor, programEnd } from './generator';
import { activate, activationConsequences, blocking, compare, findProgram, makeDraft, nameOf, nextMonday, parseSpec, previousProgram, saveDraft, specOf, suggestedStart, suggestWeeks, validateProgram, weekPreview } from './programs';
import { recordsUntil } from './records';
import { applyMove, checkMove, movable } from './reschedule';
import type { AppState, DataScope, ISODate, ProgramDef } from './types';

/* ============================================================
   Fonctions métier du coach. C'est la SEULE surface d'action : le modèle (local ou externe) propose un appel,
   BYYND vérifie qu'il existe, que les permissions le couvrent et que ses paramètres sont valides.
   Une écriture n'est jamais exécutée à la proposition : elle devient une carte, exécutée après confirmation,
   et ses paramètres sont revalidés au moment de l'exécution.
   ============================================================ */

export const SCOPE_LABEL: Record<DataScope, string> = { programs: 'Objectifs et programmes', history: 'Historique d\'entraînement', strava: 'Activités Strava', recovery: 'Récupération et check-ins', body: 'Mensurations et poids', sensitive: 'Données sensibles (cycle, douleurs, notes)' };
export const DEFAULT_PERMS: Record<DataScope, boolean> = { programs: true, history: true, strava: true, recovery: true, body: false, sensitive: false };
export const permsOf = (s: AppState): Record<DataScope, boolean> => ({ ...DEFAULT_PERMS, ...(s.coach?.perms || {}) });

type Param = { type: 'date' | 'int' | 'string' | 'object' | 'enum' | 'list'; max_items?: number; required?: boolean; min?: number; max?: number; values?: string[]; max_len?: number };
export interface ToolDef { name: string; description: string; scopes: DataScope[]; write: boolean; params: Record<string, Param> }
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const TOOLS: ToolDef[] = [
  { name: 'get_active_program', description: 'Programme en cours, semaine, phase, prochains programmes.', scopes: ['programs'], write: false, params: {} },
  { name: 'get_training_history', description: 'Séances et activités sur une période.', scopes: ['history'], write: false, params: { days: { type: 'int', min: 1, max: 120 }, type: { type: 'enum', values: ['running', 'all'] }, last: { type: 'int', min: 1, max: 20 } } },
  { name: 'get_running_progress', description: 'Allures faciles, tests, régularité de course.', scopes: ['history'], write: false, params: {} },
  { name: 'get_recovery_summary', description: 'Niveau de récupération du jour et raisons.', scopes: ['recovery'], write: false, params: { date: { type: 'date' } } },
  { name: 'get_upcoming_events', description: 'Compétitions à venir.', scopes: ['programs'], write: false, params: { days: { type: 'int', min: 1, max: 365 } } },
  { name: 'get_personal_records', description: 'Records personnels.', scopes: ['history'], write: false, params: {} },
  { name: 'preview_workout_reschedule', description: 'Vérifie le déplacement d\'une séance (conflits, récupération).', scopes: ['programs'], write: false, params: { from: { type: 'date', required: true }, to: { type: 'date', required: true } } },
  { name: 'apply_workout_reschedule', description: 'Déplace une séance (après confirmation).', scopes: ['programs'], write: true, params: { from: { type: 'date', required: true }, to: { type: 'date', required: true }, swap: { type: 'enum', values: ['yes', 'no'] } } },
  { name: 'adapt_today', description: 'Allège la séance d\'un jour (après confirmation).', scopes: ['programs', 'recovery'], write: true, params: { date: { type: 'date', required: true }, kind: { type: 'enum', values: ['easy', 'reduced', 'rest'], required: true }, reason: { type: 'string', max_len: 160 } } },
  { name: 'set_session', description: 'Remplace la séance d\'un jour par une autre (type, titre, durée, étapes), après confirmation.', scopes: ['programs'], write: true,
    params: { date: { type: 'date', required: true }, type: { type: 'enum', values: ['run', 'box', 'hyrox', 'renfo', 'recup', 'rest'], required: true }, title: { type: 'string', required: true, max_len: 60 }, dur: { type: 'string', max_len: 40 }, goal: { type: 'string', max_len: 200 }, steps: { type: 'list', max_items: 12, max_len: 160 }, intensity: { type: 'enum', values: ['facile', 'qualite'] }, reason: { type: 'string', max_len: 160 } } },
  { name: 'restore_session', description: 'Remet la séance prévue par le programme un jour donné (annule un changement).', scopes: ['programs'], write: true, params: { date: { type: 'date', required: true } } },
  { name: 'create_program_draft', description: 'Crée un brouillon de programme (jamais activé).', scopes: ['programs'], write: true, params: { spec: { type: 'object', required: true }, start: { type: 'date' }, weeks: { type: 'int', min: 4, max: 30 }, name: { type: 'string', max_len: 60 } } },
  { name: 'update_program_draft', description: 'Modifie un brouillon existant (semaine type, objectif, dates, nom). Reste un brouillon.', scopes: ['programs'], write: true, params: { id: { type: 'string', required: true, max_len: 40 }, spec: { type: 'object' }, start: { type: 'date' }, weeks: { type: 'int', min: 4, max: 30 }, name: { type: 'string', max_len: 60 } } },
  { name: 'change_current_program', description: 'Change le programme en cours à partir d\'un lundi à venir : l\'historique est gardé, la suite suit la nouvelle semaine type (après confirmation).', scopes: ['programs'], write: true, params: { spec: { type: 'object', required: true }, from: { type: 'date' }, weeks: { type: 'int', min: 4, max: 30 }, name: { type: 'string', max_len: 60 } } },
  { name: 'preview_program', description: 'Aperçu et vérification d\'un programme.', scopes: ['programs'], write: false, params: { id: { type: 'string', required: true, max_len: 40 } } },
  { name: 'confirm_program_activation', description: 'Active un brouillon (après confirmation explicite).', scopes: ['programs'], write: true, params: { id: { type: 'string', required: true, max_len: 40 } } },
];
export const toolByName = (n: string) => TOOLS.find(t => t.name === n) || null;
/** Schémas JSON des fonctions (pour un futur modèle externe ou serveur MCP). */
export const toolSchemas = () => TOOLS.map(t => ({ name: t.name, description: t.description, input_schema: { type: 'object', properties: Object.fromEntries(Object.entries(t.params).map(([k, p]) => [k, p.type === 'date' ? { type: 'string', format: 'date' } : p.type === 'int' ? { type: 'integer', minimum: p.min, maximum: p.max } : p.type === 'enum' ? { type: 'string', enum: p.values } : p.type === 'object' ? { type: 'object' } : p.type === 'list' ? { type: 'array', items: { type: 'string', maxLength: p.max_len }, maxItems: p.max_items } : { type: 'string', maxLength: p.max_len }])), required: Object.entries(t.params).filter(([, p]) => p.required).map(([k]) => k), additionalProperties: false } }));

export type Checked = { ok: true; tool: ToolDef; args: Record<string, unknown> } | { ok: false; error: string };
/** Contrôle d'un appel proposé : fonction connue, permissions accordées, paramètres conformes. Les clés inconnues sont refusées. */
export function checkCall(s: AppState, name: unknown, args: unknown): Checked {
  const tool = typeof name === 'string' ? toolByName(name) : null;
  if (!tool) return { ok: false, error: 'Fonction inconnue : rien n\'est exécuté.' };
  const perms = permsOf(s); const missing = tool.scopes.filter(sc => !perms[sc]);
  if (missing.length) return { ok: false, error: `Accès non autorisé : ${missing.map(m => SCOPE_LABEL[m].toLowerCase()).join(', ')}. Tu peux l'autoriser dans les réglages du coach.` };
  const a = (args && typeof args === 'object' && !Array.isArray(args) ? args : {}) as Record<string, unknown>;
  for (const k of Object.keys(a)) if (!(k in tool.params)) return { ok: false, error: `Paramètre non prévu : ${k.slice(0, 20)}.` };
  const out: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(tool.params)) {
    const v = a[k];
    if (v == null) { if (p.required) return { ok: false, error: `Paramètre manquant : ${k}.` }; continue; }
    if (p.type === 'date' && !(typeof v === 'string' && DATE.test(v) && !isNaN(Date.parse(v)))) return { ok: false, error: `Date invalide : ${k}.` };
    if (p.type === 'int' && !(Number.isInteger(v) && (p.min == null || (v as number) >= p.min) && (p.max == null || (v as number) <= p.max))) return { ok: false, error: `Nombre invalide : ${k}.` };
    if (p.type === 'enum' && !p.values!.includes(v as string)) return { ok: false, error: `Valeur invalide : ${k}.` };
    if (p.type === 'string' && !(typeof v === 'string' && v.length <= (p.max_len || 200))) return { ok: false, error: `Texte invalide : ${k}.` };
    if (p.type === 'object' && !(typeof v === 'object' && !Array.isArray(v))) return { ok: false, error: `Objet invalide : ${k}.` };
    if (p.type === 'list' && !(Array.isArray(v) && v.length <= (p.max_items || 12) && v.every(x => typeof x === 'string' && x.length <= (p.max_len || 200)))) return { ok: false, error: `Liste invalide : ${k}.` };
    out[k] = v;
  }
  return { ok: true, tool, args: out };
}

/* ---------- Lectures (aucun effet) ---------- */
const pace = (a: { durationMin?: number | null; distanceKm?: number | null }) => (a.durationMin! * 60) / a.distanceKm!;
export function read(s: AppState, name: string, a: Record<string, unknown>, today: ISODate): unknown {
  switch (name) {
    case 'get_active_program': { const p = s.program; const w = Math.max(1, Math.floor((Date.parse(today) - Date.parse(p.start)) / 6048e5) + 1);
      return { name: nameOf(p), start: p.start, end: programEnd(p), weeks: p.weeks, week: Math.min(w, p.weeks), focus: p.template === 'custom' ? FOCUS_LABEL[specOf(p).focus] : 'Progresser sur 10 km', next: (s.programs || []).filter(x => x.status === 'planned').map(x => ({ id: x.id, name: nameOf(x), start: x.start })) }; }
    case 'get_training_history': { const days = (a.days as number) || 28; const from = addDays(today, -days); const runOnly = a.type === 'running';
      const strava = permsOf(s).strava;
      let xs = s.activities.filter(x => x.date >= from && x.date <= today && !x.complementary && (strava || x.source !== 'strava') && (!runOnly || x.type === 'running' || x.type === 'course')).sort((x, y) => y.date.localeCompare(x.date));
      if (a.last) xs = xs.slice(0, a.last as number);
      // Données minimales : jamais les notes libres ni les titres bruts dans le contexte d'un modèle.
      return xs.map(x => ({ date: x.date, type: x.type, km: x.distanceKm ?? null, min: x.durationMin ?? null, pace: x.distanceKm && x.durationMin ? Math.round(pace(x)) : null, hr: x.avgHr ?? null, effort: x.effort ?? null, elev: x.elevM ?? null, kind: x.kind || null, source: x.source })); }
    case 'get_running_progress': { const rs = runsList(s).filter(r => (permsOf(s).strava || r.source !== 'strava') && r.date <= today && (r.kind || 'facile') === 'facile' && pace(r) > 240 && pace(r) < 600);
      const last = rs.slice(-6); const first = rs.slice(0, Math.min(3, rs.length));
      return { easyRuns: rs.length, recent: last.map(r => ({ date: r.date, pace: Math.round(pace(r)), hr: r.avgHr ?? null, km: r.distanceKm, elev: r.elevM ?? null, effort: r.effort ?? null })), firstAvg: first.length ? Math.round(first.reduce((t, r) => t + pace(r), 0) / first.length) : null, ref: s.user.ref }; }
    case 'get_recovery_summary': { const d = (a.date as ISODate) || today; const r = recovery(s, d); return { date: d, level: r.level, reasons: r.reasons }; }
    case 'get_upcoming_events': { const to = addDays(today, (a.days as number) || 180); return s.events.filter(e => e.status === 'prévu' && e.date >= today && e.date <= to).sort((x, y) => x.date.localeCompare(y.date)).map(e => ({ id: e.id, name: e.name, date: e.date, km: e.distanceKm ?? null, type: e.type, priority: e.priority })); }
    case 'get_personal_records': return recordsUntil(s, today).map(r => ({ label: r.label, value: r.value, date: r.date }));
    case 'preview_workout_reschedule': return checkMove(s, a.from as ISODate, a.to as ISODate, today);
    case 'preview_program': { const p = findProgram(s, a.id as string); return p ? { name: nameOf(p), issues: validateProgram(s, p, today) } : null; }
  }
  return null;
}

/* ---------- Écritures : préparation (carte) puis exécution confirmée ---------- */
export interface Prepared { title: string; summary: string; consequences: string[]; issues: { severity: 'block' | 'warn' | 'info' | 'ok'; text: string }[]; executable: boolean; draft?: ProgramDef }
export function prepare(s: AppState, name: string, a: Record<string, unknown>, today: ISODate): Prepared {
  switch (name) {
    case 'apply_workout_reschedule': {
      const from = a.from as ISODate, to = a.to as ISODate; const can = movable(s, from, today);
      if (!can.ok) return { title: 'Déplacement impossible', summary: can.why || '', consequences: [], issues: [{ severity: 'block', text: can.why || 'Séance non déplaçable.' }], executable: false };
      const c = checkMove(s, from, to, today); const p = planFor(s, from);
      return { title: `${p.title} : ${fmtDay(from)} → ${fmtDay(to)}`, summary: c.result,
        consequences: [c.result, c.swapWith && a.swap !== 'no' ? `${c.swapWith.title} passe au ${fmtDay(from)}.` : '', 'Tes coches et notes suivent la séance. Annulable depuis la séance.'].filter(Boolean),
        issues: c.issues.map(i => ({ severity: i.severity, text: i.text })), executable: c.verdict !== 'block' };
    }
    case 'adapt_today': {
      const d = a.date as ISODate; const p = adapted(s, d); const kind = a.kind as 'easy' | 'reduced' | 'rest';
      if (d < today) return { title: 'Jour passé', summary: '', consequences: [], issues: [{ severity: 'block', text: 'On n\'adapte pas une séance passée.' }], executable: false };
      const what = kind === 'rest' ? 'Repos ou récupération active à la place' : kind === 'easy' ? 'Version facile : même séance, intensité basse' : 'Version réduite : moins de volume';
      return { title: `${p.title}, ${fmtDay(d)}`, summary: what, consequences: [`${what}.`, 'Le reste de la semaine ne change pas.', 'Annulable depuis la séance du jour.'], issues: p.type === 'rest' ? [{ severity: 'info', text: 'C\'est déjà un jour de repos.' }] : [], executable: p.type !== 'rest' };
    }
    case 'set_session': {
      const d = a.date as ISODate; const cur = adapted(s, d); const t = String(a.type);
      const label: Record<string, string> = { run: 'Course', box: 'CrossFit', hyrox: 'HYROX', renfo: 'Renforcement', recup: 'Récupération active', rest: 'Repos' };
      if (d < today) return { title: 'Jour passé', summary: '', consequences: [], issues: [{ severity: 'block', text: 'On ne change pas une séance passée.' }], executable: false };
      if (d > addDays(today, 60)) return { title: 'Trop loin', summary: '', consequences: [], issues: [{ severity: 'block', text: 'Change une séance des 60 prochains jours ; au-delà, modifie le programme.' }], executable: false };
      if (cur.type === 'event') return { title: 'Jour de compétition', summary: '', consequences: [], issues: [{ severity: 'block', text: `${cur.title} ce jour-là : la compétition reste prioritaire.` }], executable: false };
      const steps = ((a.steps as string[]) || []).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
      const issues: Prepared['issues'] = [];
      const r = recovery(s, d); if ((t === 'run' && a.intensity === 'qualite' || t === 'box' || t === 'hyrox') && r.level === 'rouge') issues.push({ severity: 'warn', text: 'Récupération au rouge ce jour-là : séance intense déconseillée.' });
      const prevHard = adapted(s, addDays(d, -1)); if (t === 'run' && a.intensity === 'qualite' && prevHard.type === 'run' && prevHard.run?.kind === 'qualite') issues.push({ severity: 'warn', text: 'Deux séances d\'allure de suite : garde au moins un jour facile entre les deux.' });
      return { title: `${fmtDay(d)} : ${String(a.title)}`, summary: `${cur.replaced?.title || cur.title} → ${String(a.title)}${a.dur ? ` (${a.dur})` : ''}`,
        consequences: [`${label[t]}${a.dur ? `, ${a.dur}` : ''} à la place de « ${cur.replaced?.title || cur.title} ».`, ...steps.slice(0, 6).map(x => `• ${x}`), 'Le reste du programme ne change pas. Annulable depuis la séance.'],
        issues, executable: true };
    }
    case 'restore_session': {
      const d = a.date as ISODate; const ov = s.overrides[d];
      if (!ov?.custom && !ov?.adj) return { title: 'Rien à annuler', summary: '', consequences: [], issues: [{ severity: 'info', text: 'Cette séance est déjà celle du programme.' }], executable: false };
      const { custom, adj, ...rest } = ov; const orig = adapted({ ...s, overrides: { ...s.overrides, [d]: rest } }, d);
      return { title: `${fmtDay(d)} : revenir au programme`, summary: `${(orig.replaced || orig).title}`, consequences: [`Séance prévue rétablie : ${(orig.replaced || orig).title}.`], issues: [], executable: d >= today };
    }
    case 'create_program_draft': {
      const prev = previousProgram(s, today); const spec = parseSpec(a.spec, { ...specOf(prev), deloadEvery: specOf(prev).deloadEvery || 4 });
      const start = (a.start as ISODate) || suggestedStart(s, today); const goal = spec.goalEventId ? s.events.find(e => e.id === spec.goalEventId) : null;
      const weeks = (a.weeks as number) || suggestWeeks(start, goal?.date);
      const draft = makeDraft({ start, weeks, spec, name: a.name as string | undefined, basedOn: prev.id });
      const issues = validateProgram(s, draft, today);
      return { title: nameOf(draft), summary: `${FOCUS_LABEL[spec.focus]}, ${weeks} semaines à partir du ${fmtShort(start)}.`, consequences: ['Enregistré comme brouillon : ton planning ne change pas.', 'Tu pourras le modifier, le comparer, puis l\'activer.'],
        issues: issues.map(i => ({ severity: i.severity, text: i.text })), executable: !blocking(issues), draft };
    }
    case 'update_program_draft': {
      const cur = findProgram(s, a.id as string);
      if (!cur || cur.status !== 'draft') return { title: 'Brouillon introuvable', summary: '', consequences: [], issues: [{ severity: 'block', text: 'Seul un brouillon se modifie ainsi. Pour le programme en cours, propose un changement à partir d\'un lundi à venir.' }], executable: false };
      const spec = parseSpec({ ...specOf(cur), ...(a.spec as object || {}) }, specOf(cur)); const start = (a.start as ISODate) || cur.start; const weeks = (a.weeks as number) || cur.weeks;
      const draft = { ...makeDraft({ start, weeks, spec, name: (a.name as string) || cur.name, basedOn: cur.basedOn }), id: cur.id, createdAt: cur.createdAt };
      const issues = validateProgram(s, draft, today); const diff = compare(cur, draft).filter(r => r.a !== r.b).map(r => `${r.label} : ${r.a} → ${r.b}`);
      return { title: `Modifier « ${nameOf(cur)} »`, summary: diff.length ? diff.join(' ; ') : 'Aucun changement de structure.', consequences: [...(diff.length ? diff : ['Aucun changement de structure.']), 'Reste un brouillon : ton planning ne change pas.'], issues: issues.map(i => ({ severity: i.severity, text: i.text })), executable: !blocking(issues), draft };
    }
    case 'change_current_program': {
      const cur = s.program; const from = (a.from as ISODate) || nextMonday(today);
      const left = Math.ceil((Date.parse(programEnd(cur)) - Date.parse(from)) / 6048e5 + 1 / 7);
      const weeks = (a.weeks as number) || Math.max(4, Math.min(30, left));
      const spec = parseSpec({ ...specOf(cur), deloadEvery: specOf(cur).deloadEvery || 4, ...(a.spec as object || {}) }, { ...specOf(cur), deloadEvery: specOf(cur).deloadEvery || 4 });
      const draft = makeDraft({ start: from, weeks, spec, name: (a.name as string) || `${nameOf(cur).replace(/ \(ajusté.*\)$/, '')} (ajusté le ${fmtShort(from)})`, basedOn: cur.id });
      const issues = validateProgram(s, draft, today); const diff = compare(cur, draft).filter(r => r.a !== r.b && r.label !== 'Durée' && r.label !== 'Phases').map(r => `${r.label} : ${r.a} → ${r.b}`);
      return { title: `Changer de plan à partir du ${fmtShort(from)}`, summary: `${FOCUS_LABEL[spec.focus]}, ${weeks} semaines.`,
        consequences: [...diff, ...activationConsequences(s, draft, today)], issues: issues.map(i => ({ severity: i.severity, text: i.text })), executable: !blocking(issues), draft };
    }
    case 'confirm_program_activation': {
      const p = findProgram(s, a.id as string); if (!p || p.status !== 'draft') return { title: 'Programme introuvable', summary: '', consequences: [], issues: [{ severity: 'block', text: 'Seul un brouillon peut être activé.' }], executable: false };
      const issues = validateProgram(s, p, today);
      return { title: `Activer « ${nameOf(p)} »`, summary: `À partir du ${fmtShort(p.start)}.`, consequences: activationConsequences(s, p, today), issues: issues.map(i => ({ severity: i.severity, text: i.text })), executable: !blocking(issues) };
    }
  }
  return { title: 'Action inconnue', summary: '', consequences: [], issues: [{ severity: 'block', text: 'Action non reconnue.' }], executable: false };
}
/** Exécution après confirmation : contrôles refaits sur l'état du moment (une carte ancienne ne suffit pas). À appeler dans update(). */
export function execute(st: AppState, name: string, args: unknown, today: ISODate, draft?: ProgramDef): { ok: boolean; message: string } {
  const c = checkCall(st, name, args); if (!c.ok) return { ok: false, message: c.error };
  if (!c.tool.write) return { ok: false, message: 'Rien à exécuter.' };
  const pr = prepare(st, name, c.args, today); if (!pr.executable) return { ok: false, message: pr.issues[0]?.text || 'Action refusée par les règles BYYND.' };
  const a = c.args;
  switch (name) {
    case 'apply_workout_reschedule': { const chk = checkMove(st, a.from as ISODate, a.to as ISODate, today, false); applyMove(st, a.from as ISODate, a.to as ISODate, !!chk.swapWith && a.swap !== 'no'); return { ok: true, message: pr.summary }; }
    case 'adapt_today': { const d = a.date as ISODate; st.overrides[d] = { ...(st.overrides[d] || {}), adj: { kind: a.kind as 'easy' | 'reduced' | 'rest', reason: String(a.reason || 'Adapté avec le coach').slice(0, 160), proposalId: `coach-${d}` } }; return { ok: true, message: pr.summary }; }
    case 'set_session': { const d = a.date as ISODate; const steps = ((a.steps as string[]) || []).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
      const { adj, ...rest } = st.overrides[d] || {};
      st.overrides[d] = { ...rest, custom: { type: a.type as 'run', title: String(a.title).trim(), dur: (a.dur as string) || undefined, goal: (a.goal as string) || undefined, steps: steps.length ? steps : undefined, intensity: (a.intensity as 'facile') || undefined, reason: (a.reason as string) || undefined, at: Date.now() } };
      return { ok: true, message: pr.title }; }
    case 'restore_session': { const d = a.date as ISODate; const { custom, adj, ...rest } = st.overrides[d] || {}; st.overrides[d] = rest; return { ok: true, message: 'Séance du programme rétablie.' }; }
    case 'create_program_draft': { const d = draft && draft.status === 'draft' ? { ...pr.draft!, id: draft.id } : pr.draft!; saveDraft(st, d); return { ok: true, message: `Brouillon « ${nameOf(d)} » enregistré.` }; }
    case 'update_program_draft': { saveDraft(st, pr.draft!); return { ok: true, message: `Brouillon « ${nameOf(pr.draft!)} » mis à jour.` }; }
    case 'change_current_program': { saveDraft(st, pr.draft!); const r = activate(st, pr.draft!.id, today); return { ok: r.ok, message: r.ok ? `Nouveau plan à partir du ${fmtShort(pr.draft!.start)}. L'historique est gardé.` : r.issues[0]?.text || 'Changement refusé.' }; }
    case 'confirm_program_activation': { const r = activate(st, a.id as string, today); return { ok: r.ok, message: r.ok ? 'Programme activé.' : r.issues[0]?.text || 'Activation refusée.' }; }
  }
  return { ok: false, message: 'Action inconnue.' };
}

/** Contexte minimal pour un modèle externe : uniquement les catégories autorisées, sans notes libres, sans identifiants ni jetons. */
export function minimalContext(s: AppState, today: ISODate): Record<string, unknown> {
  const p = permsOf(s); const out: Record<string, unknown> = { today };
  if (p.programs) out.program = read(s, 'get_active_program', {}, today);
  if (p.programs) out.events = read(s, 'get_upcoming_events', { days: 120 }, today);
  if (p.history) out.recentTraining = read(s, 'get_training_history', { days: 14 }, today);
  if (p.recovery) out.recovery = read(s, 'get_recovery_summary', {}, today);
  if (p.body) { const ws = s.measurements.filter(m => m.weight).sort((a, b) => a.date.localeCompare(b.date)).slice(-4); out.weight = ws.map(m => ({ date: m.date, kg: m.weight })); }
  return out;
}
export const _t = { dow, mmss, committed, phasesFor, weekPreview };

const DOW = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
/** Contexte du coach conversationnel : ce que Claude « voit » de l'app. Uniquement les catégories autorisées, des faits structurés,
 *  jamais de notes libres, de titres d'activités importés, d'identifiants de compte ni de jetons. */
export function coachContext(s: AppState, today: ISODate): Record<string, unknown> {
  const p = permsOf(s); const out: Record<string, unknown> = { aujourdhui: `${DOW[dow(today)]} ${today}` };
  const strava = p.strava;
  if (p.programs) {
    const P = s.program; const w = Math.min(P.weeks, Math.max(1, weekOf(s, today))); const ph = phaseOf(w, P);
    out.programme = { nom: nameOf(P), debut: P.start, fin: programEnd(P), semaine: `${w} sur ${P.weeks}`, phase: `${ph.name} : ${ph.goal}`, objectif: P.template === 'custom' ? FOCUS_LABEL[specOf(P).focus] : s.user.goals.run,
      semaineType: specOf(P).days.map((d, i) => `${DOW[i]} ${d}`).join(', '), contraintes: s.user.constraints || specOf(P).constraints || null };
    out.objectifs = { course: s.user.goals.run, poidsSouhaite: p.body ? s.user.goals.weightTarget : undefined };
    const day = (d: ISODate) => { const a = adapted(s, d); const sh = a.replaced || a;
      return { date: d, jour: DOW[dow(d)], seance: sh.title, type: a.type, duree: sh.dur || null, obligatoire: a.mandatory, faite: d < today || d === today ? doneOn(s, d) : undefined,
        deplaceeDepuis: a.movedFrom || undefined, adaptation: a.reason || undefined, changeeAvecCoach: a.custom || undefined, etapes: a.run && !a.replaced ? a.run.steps.map(x => x.zone ? `${x.text} (${zoneText(s, x.zone)})` : x.text) : a.details && !a.replaced ? a.details : undefined }; };
    out.planning = Array.from({ length: 22 }, (_, i) => addDays(today, i - 7)).map(day);
    out.competitions = s.events.filter(e => e.status !== 'annulé' && e.date >= addDays(today, -30)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8)
      .map(e => ({ id: e.id, nom: e.name, date: e.date, km: e.distanceKm ?? null, priorite: e.priority, statut: e.status, resultat: e.result ? (e.type === 'crossfit-compet' ? [e.result.rank && `classement ${e.result.rank}`, e.result.score].filter(Boolean).join(', ') || 'terminée' : e.distanceKm ? mmss(e.result.time / e.distanceKm) + ' /km' : `${Math.round(e.result.time / 60)} min`) : undefined, type: e.type }));
    out.autresProgrammes = (s.programs || []).filter(x => x.status !== 'archived').map(x => ({ id: x.id, nom: nameOf(x), statut: x.status, debut: x.start, semaines: x.weeks, objectif: x.template === 'custom' ? specOf(x).focus : undefined, semaineType: x.template === 'custom' ? specOf(x).days.join(',') : undefined, allegement: x.spec?.deloadEvery }));
    out.programme = { ...(out.programme as object), id: P.id, allegementToutesLes: specOf(P).deloadEvery || null, prochainLundi: nextMonday(today) };
  }
  if (p.history) {
    const from = addDays(today, -28);
    out.activitesRecentes = s.activities.filter(a => a.date >= from && a.date <= today && (strava || a.source !== 'strava')).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)
      .map(a => ({ date: a.date, type: a.type, km: a.distanceKm ?? undefined, min: a.durationMin ?? undefined, allure: a.distanceKm && a.durationMin ? mmss(pace(a)) + ' /km' : undefined, fc: a.avgHr ?? undefined, denivele: a.elevM ?? undefined, effort: a.effort ?? undefined, nature: a.kind || undefined, complementaire: a.complementary || undefined }));
    out.records = recordsUntil(s, today).map(r => `${r.label} : ${r.value} (${r.date})`);
    out.allures = (Object.keys(ZONE_NAME) as (keyof typeof ZONE_NAME)[]).map(z => `${ZONE_NAME[z]} : ${zoneText(s, z)}`);
  }
  if (p.recovery) {
    out.recuperation = [today, addDays(today, -1)].map(d => { const r = recovery(s, d); return { date: d, niveau: r.level, raisons: r.reasons }; });
    out.checkins = Object.keys(s.checkins).filter(k => k >= addDays(today, -7) && k <= today).sort().map(k => { const c = s.checkins[k]; return { date: k, sommeil: c.sleep, energie: c.energy, courbatures: c.soreness, douleur: c.pain === 'oui' ? 'oui' : 'non', motivation: c.motivation }; });
  }
  const notes = (s.coach?.notes || []).map(n => n.text); if (notes.length) out.notesRetenues = notes;
  if (p.body) out.poids = s.measurements.filter(m => m.weight).sort((a, b) => a.date.localeCompare(b.date)).slice(-6).map(m => ({ date: m.date, kg: m.weight }));
  return JSON.parse(JSON.stringify(out)); // retire les champs vides
}
