import type { AppState, ExerciseLog, Mark, ProgramDef, StrengthLog } from './types';

/** Fusion de deux versions de l'état (téléphone / serveur) : rien n'est perdu.
 *  Listes fusionnées par identifiant, journaux champ par champ, coches élément par élément (la plus récente gagne).
 *  En cas d'égalité, la version locale l'emporte. Une suppression (activité) ou un décochage n'est jamais annulé par l'autre version. */
export function mergeStates(local: AppState, remote: AppState): AppState {
  const out: AppState = structuredClone(local);
  const byId = <T extends { id: string }>(a: T[], b: T[]) => { const m = new Map(b.map(x => [x.id, x])); a.forEach(x => m.set(x.id, x)); return [...m.values()]; };
  // Suppressions : l'union des deux côtés, puis on retire les activités supprimées.
  out.deleted = maxMap(local.deleted, remote.deleted);
  out.activities = byId(local.activities, remote.activities || []).filter(a => !out.deleted?.[a.id]);
  // une activité Strava et sa saisie manuelle ne doivent pas coexister deux fois
  const seenStrava = new Set<string>();
  out.activities = out.activities.filter(a => !a.stravaId || (seenStrava.has(a.stravaId) ? false : (seenStrava.add(a.stravaId), true)));
  out.measurements = byId(local.measurements, remote.measurements || []);
  out.events = byId(local.events, remote.events || []).map(e => {
    const r = remote.events?.find(x => x.id === e.id); if (!r || r === e) return e;
    return { ...e, result: e.result ?? r.result, status: e.status === 'prévu' && r.status !== 'prévu' ? r.status : e.status, checklist: { ...(r.checklist || {}), ...(e.checklist || {}) } };
  });
  for (const k of Object.keys(remote.checkins || {})) {
    const l = local.checkins[k], r = remote.checkins[k];
    out.checkins[k] = !l ? r : (r.at || 0) > (l.at || 0) ? { ...l, ...r } : { ...r, ...l };
  }
  for (const k of Object.keys(remote.strength || {})) out.strength[k] = mergeStrength(local.strength[k], remote.strength[k]);
  for (const k of Object.keys(remote.runs || {})) { const l = local.runs[k], r = remote.runs[k]; out.runs[k] = !l ? r : { ...r, ...l, steps: { ...(r.steps || {}), ...(l.steps || {}) } }; }
  out.checks = mergeChecks(local.checks, remote.checks);
  out.reschedule = mergeReschedule(local.reschedule, remote.reschedule);
  for (const k of Object.keys(remote.overrides || {})) out.overrides[k] = { ...remote.overrides[k], ...(local.overrides[k] || {}) };
  out.closures = maxMap(local.closures, remote.closures);
  out.recapsSeen = maxMap(local.recapsSeen, remote.recapsSeen);
  out.celebrated = maxMap(local.celebrated, remote.celebrated);
  out.proposals = { ...(remote.proposals || {}), ...(local.proposals || {}) };
  // Profil et programme : pas d'horodatage par champ, la version modifiée le plus récemment l'emporte (jamais un état de départ).
  if ((remote.updatedAt || 0) > (local.updatedAt || 0) && remote.user) out.user = structuredClone(remote.user);
  // Programmes : union par identifiant, la version modifiée le plus récemment gagne. Le programme en cours est le plus avancé des deux (le relais ne recule jamais).
  const progs = new Map<string, ProgramDef>();
  for (const p of [remote.program, ...(remote.programs || []), local.program, ...(local.programs || [])]) { if (!p) continue; const o = progs.get(p.id); if (!o || (p.updatedAt || 0) > (o.updatedAt || 0)) progs.set(p.id, p); }
  const curId = (remote.program && remote.program.start > local.program.start ? remote.program : local.program).id;
  out.program = structuredClone(progs.get(curId)!); out.programs = structuredClone([...progs.values()].filter(p => p.id !== curId));
  out.user.ref = { k10: min(local.user.ref.k10, remote.user?.ref?.k10), k5: min(local.user.ref.k5, remote.user?.ref?.k5) };
  out.strava = { since: Math.max(local.strava?.since || 0, remote.strava?.since || 0), fillAt: Math.max(local.strava?.fillAt || 0, remote.strava?.fillAt || 0) || undefined };
  out.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
  return out;
}

/** Déplacements : séance par séance, le plus récent gagne (une annulation est un déplacement vers la date d'origine, donc elle se synchronise aussi). */
export function mergeReschedule(a?: AppState['reschedule'], b?: AppState['reschedule']): AppState['reschedule'] {
  if (!a || !b) return structuredClone(a || b);
  const moves = { ...b.moves }; for (const [k, m] of Object.entries(a.moves)) if (!moves[k] || m.at >= moves[k].at) moves[k] = m;
  const h = (a.habitsAt || 0) >= (b.habitsAt || 0) ? a : b;
  return { moves, habits: structuredClone(h.habits), habitsAt: h.habitsAt };
}

/** Coches : élément par élément, la plus récente gagne (un décochage récent l'emporte sur une coche ancienne). */
export function mergeChecks(a?: AppState['checks'], b?: AppState['checks']): AppState['checks'] {
  const out: NonNullable<AppState['checks']> = structuredClone(a || {});
  for (const [d, items] of Object.entries(b || {})) {
    const day = (out[d] = out[d] || {});
    for (const [id, m] of Object.entries(items)) if (!day[id] || (m as Mark).at > day[id].at) day[id] = m as Mark;
  }
  return out;
}

/** Journal de renforcement : exercice par exercice, série par série. Une valeur saisie n'est jamais remplacée par une case vide. */
function mergeStrength(l: StrengthLog | undefined, r: StrengthLog): StrengthLog {
  if (!l) return r;
  const ex: Record<string, ExerciseLog> = { ...r.ex };
  for (const [id, e] of Object.entries(l.ex || {})) {
    const o = r.ex?.[id]; if (!o) { ex[id] = e; continue; }
    const n = Math.max(e.kg.length, o.kg.length, e.reps.length, o.reps.length, e.done.length, o.done.length);
    const pick = <T,>(x: T | null | undefined, y: T | null | undefined) => (x != null && x !== '' ? x : y ?? null);
    ex[id] = { kg: Array.from({ length: n }, (_, i) => pick(e.kg[i], o.kg[i])), reps: Array.from({ length: n }, (_, i) => pick(e.reps[i], o.reps[i])), done: Array.from({ length: n }, (_, i) => !!(e.done[i] ?? o.done[i])) };
  }
  return { ...r, ...l, ex, warm: { ...(r.warm || {}), ...(l.warm || {}) } };
}
function maxMap(a?: Record<string, number>, b?: Record<string, number>) {
  const out: Record<string, number> = { ...(b || {}) };
  for (const [k, v] of Object.entries(a || {})) out[k] = Math.max(v, out[k] || 0);
  return out;
}
const min = (a?: number | null, b?: number | null) => (a && b ? Math.min(a, b) : a || b || null);
