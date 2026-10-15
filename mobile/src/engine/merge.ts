import type { AppState } from './types';

/** Fusion de deux versions de l'état (téléphone / serveur) : rien n'est perdu.
 *  Listes fusionnées par identifiant, journaux par date ; en cas d'égalité, la version locale l'emporte. */
export function mergeStates(local: AppState, remote: AppState): AppState {
  const out: AppState = structuredClone(local);
  const byId = <T extends { id: string }>(a: T[], b: T[]) => { const m = new Map(b.map(x => [x.id, x])); a.forEach(x => m.set(x.id, x)); return [...m.values()]; };
  out.activities = byId(local.activities, remote.activities || []);
  // une activité Strava et sa saisie manuelle ne doivent pas coexister deux fois
  const seenStrava = new Set<string>();
  out.activities = out.activities.filter(a => !a.stravaId || (seenStrava.has(a.stravaId) ? false : (seenStrava.add(a.stravaId), true)));
  out.measurements = byId(local.measurements, remote.measurements || []);
  out.events = byId(local.events, remote.events || []);
  for (const k of Object.keys(remote.checkins || {})) {
    const l = local.checkins[k], r = remote.checkins[k];
    out.checkins[k] = !l ? r : (r.at || 0) > (l.at || 0) ? { ...l, ...r } : { ...r, ...l };
  }
  for (const k of Object.keys(remote.strength || {})) if (!local.strength[k]) out.strength[k] = remote.strength[k];
  for (const k of Object.keys(remote.runs || {})) if (!local.runs[k]) out.runs[k] = remote.runs[k];
  for (const k of Object.keys(remote.overrides || {})) out.overrides[k] = { ...remote.overrides[k], ...(local.overrides[k] || {}) };
  out.user.ref = { k10: min(local.user.ref.k10, remote.user?.ref?.k10), k5: min(local.user.ref.k5, remote.user?.ref?.k5) };
  out.strava = { since: Math.max(local.strava?.since || 0, remote.strava?.since || 0) };
  out.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
  return out;
}
const min = (a?: number | null, b?: number | null) => (a && b ? Math.min(a, b) : a || b || null);
