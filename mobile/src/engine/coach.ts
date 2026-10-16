import { addDays, daysBetween, dow, mmss, num, parseISO } from './dates';
import { EX, FIXED, RUN, WED, type Exercise } from './library';
import type { Activity, AdaptedPlan, AppState, ISODate, Level, Measurement, Plan, RunSession, SportEvent, Zone } from './types';

/* ---------- calendrier ---------- */
export const DELOAD = [12];
export const daysBetweenSafe = (a: ISODate, b: ISODate) => daysBetween(a, b);
export const weekOf = (s: AppState, d: ISODate) => Math.floor(daysBetween(s.program.start, d) / 7) + 1;
export const weekStart = (s: AppState, w: number) => addDays(s.program.start, (w - 1) * 7);
export function phaseOf(w: number) {
  if (w <= 5) return { n: 'A', name: 'Évaluation' };
  if (w <= 10) return { n: 'B', name: 'Base aérobie' };
  if (w <= 15) return { n: 'C', name: 'Seuil' };
  if (w <= 19) return { n: 'D', name: 'Spécifique 10 km' };
  return { n: 'E', name: 'Bilan' };
}
export const eventOn = (s: AppState, d: ISODate) => s.events.find(e => e.date === d && e.status !== 'annulé');
export const activitiesOn = (s: AppState, d: ISODate) => s.activities.filter(a => a.date === d);
/** Une séance est validée par une activité non complémentaire ce jour-là. Les promenades ne valident rien. */
export const countsFor = (a: Activity, d: ISODate) => !a.complementary && (a.source !== 'strava' || a.matched === d);
export const doneOn = (s: AppState, d: ISODate) => activitiesOn(s, d).some(a => countsFor(a, d));

function satRun(s: AppState, w: number, wed: RunSession): RunSession {
  const ph = phaseOf(w);
  const nearEvent = s.events.some(e => e.status !== 'annulé' && e.date >= weekStart(s, w) && e.date <= addDays(weekStart(s, w), 13));
  if (wed.kind === 'qualite' || wed.kind === 'test' || nearEvent || ph.n === 'A') return RUN.easy(ph.n === 'A' ? 40 : 45, 4);
  if (ph.n === 'B') return RUN.easy(50, 6);
  return RUN.tempo();
}

export function planFor(s: AppState, d: ISODate): Plan {
  const w = weekOf(s, d), i = dow(d), ov = s.overrides[d] || {}, ev = eventOn(s, d);
  let p: Omit<Plan, 'optional' | 'mandatory' | 'date' | 'week'> & Partial<Plan>;
  const fx = FIXED[d];
  if (ev) p = { type: 'event', title: ev.name, dur: ev.distanceKm ? `${ev.distanceKm} km` : '', goal: ev.goal, event: ev };
  else if (d < s.user.startDate) p = { type: 'rest', title: 'Avant le début', goal: 'Le programme a commencé le 14 octobre.' };
  else if (fx) {
    if (fx.type === 'run') p = { type: 'run', title: fx.run.title, dur: fx.run.dur, goal: fx.run.goal, run: fx.run, note: fx.note, optional: !!fx.optional };
    else if (fx.type === 'renfo') p = strength(true);
    else p = { ...fx };
  } else if (w < 1 || w > s.program.weeks) p = { type: 'rest', title: 'Hors cycle' };
  else {
    const run = WED[w] || RUN.easy(40);
    if (i === 0 || i === 4) p = { type: 'rest', title: 'Repos', goal: i === 4 ? 'Repos avant le week-end.' : 'Repos complet. Une marche est bienvenue.' };
    else if (i === 1 || i === 3) p = { type: 'box', title: 'CrossFit' };
    else if (i === 2) p = { type: 'run', title: run.title, dur: run.dur, goal: run.goal, run };
    else if (i === 5) {
      if (ov.noHyrox) { const r = satRun(s, w, run); p = { type: 'run', title: r.title, dur: r.dur, goal: r.goal, run: r, alt: true, note: 'Remplace le cours HYROX' }; }
      else p = { type: 'box', title: 'Cours HYROX', hyrox: true };
    } else p = strength(false);
    if (DELOAD.includes(w) && p.type === 'renfo') p.note = 'Semaine allégée';
  }
  const optional = p.type === 'renfo' || p.type === 'recup' || !!p.optional;
  const mandatory = !optional && (p.type === 'box' || p.type === 'run' || p.type === 'event');
  return { ...p, date: d, week: w, optional, mandatory, skipped: !!ov.skip } as Plan;
}
function strength(short: boolean) {
  return { type: 'renfo' as const, title: short ? 'Renforcement, version courte' : 'Renforcement full body', dur: short ? '25–30 min' : '35–45 min',
    goal: 'Épaules, dos, fessiers, abdos. Optionnel : fatiguée, tu le supprimes.', short };
}

/* ---------- récupération ---------- */
export function loadSignals(s: AppState, d: ISODate): string[] {
  const sig: string[] = []; const y = addDays(d, -1), y2 = addDays(d, -2);
  activitiesOn(s, y).forEach(a => { if ((a.effort ?? 0) >= 8) sig.push(`${a.title} hier à ${a.effort}/10`); });
  const ey = eventOn(s, y), ey2 = eventOn(s, y2);
  if (ey) sig.push(`${ey.name} hier`); else if (ey2) sig.push(`${ey2.name} avant-hier`);
  const hard = [y, y2, addDays(d, -3)].flatMap(x => activitiesOn(s, x).filter(a => (a.effort ?? 0) >= 8 || a.type === 'course')).length;
  if (hard >= 2) sig.push('deux séances dures en 72 h');
  return sig;
}
export function recovery(s: AppState, d: ISODate): { level: Level; reasons: string[]; shoulder: boolean } {
  const c = s.checkins[d]; const load = loadSignals(s, d);
  const complete = !!(c && c.sleep && c.energy && c.soreness && c.pain && c.motivation);
  if (!complete) return { level: 'inconnu', reasons: [load.length ? `Pas de check-in. Charge récente : ${load.join(', ')}.` : "Pas de check-in aujourd'hui : séance du plan."], shoulder: false };
  const sig: string[] = [];
  if (c!.sleep === 'mal') sig.push('nuit difficile');
  if ((c!.energy ?? 5) <= 2) sig.push('énergie basse');
  if (c!.soreness === 'fortes') sig.push('courbatures fortes');
  if ((c!.motivation ?? 5) <= 1) sig.push('motivation à 1');
  sig.push(...load);
  let red = false; const pl = c!.painLevel ?? 0; const shoulder = c!.pain === 'oui' && /paule/.test(c!.painZone || '');
  if (c!.pain === 'oui' && pl >= 4) { red = true; sig.unshift(`douleur ${c!.painZone || ''} ${pl}/10`.replace('  ', ' ')); }
  else if (shoulder && pl >= 3) { red = true; sig.unshift(`épaule ${pl}/10`); }
  else if (c!.pain === 'oui') sig.push(`gêne ${c!.painZone || ''} ${pl}/10`.replace('  ', ' '));
  const level: Level = red || sig.length >= 2 ? 'rouge' : sig.length === 1 ? 'orange' : 'vert';
  return { level, reasons: [sig.length ? cap(sig.join(', ')) + '.' : 'Sommeil, énergie et charge récente dans la norme.'], shoulder };
}
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function adapted(s: AppState, d: ISODate): AdaptedPlan {
  const p = planFor(s, d), r = recovery(s, d), ov = s.overrides[d] || {};
  const lv = ov.keep && !ov.level ? 'vert' : ov.level || r.level;
  const a: AdaptedPlan = { ...p, level: lv, reason: null };
  if (p.type === 'event' || p.type === 'rest') return a;
  // Adaptation acceptée explicitement depuis une proposition du coach
  if (ov.adj) {
    const j = ov.adj;
    if (j.kind === 'rest') { a.replaced = { type: 'recup', title: 'Récupération active', goal: 'Marche 30 min et 10 min de mobilité.' }; a.reason = j.reason; return a; }
    if (j.kind === 'easy' && p.type === 'run' && p.run && p.run.kind !== 'facile' && p.run.kind !== 'recup') { a.run = RUN.easy(40, 4); a.title = a.run.title; a.dur = a.run.dur; a.goal = a.run.goal; a.reason = j.reason; return a; }
    if ((j.kind === 'reduced' || j.kind === 'shoulder') && p.type === 'renfo') { a.level = 'orange'; a.reason = j.reason; return a; }
    if (j.kind === 'easy' && p.type === 'box') { a.reason = j.reason; return a; }
  }
  if (lv === 'rouge' && p.type !== 'box') { a.replaced = { type: 'recup', title: 'Récupération active', goal: 'Marche 30 min et 10 min de mobilité. Rien à rattraper.' }; a.reason = 'Rouge : ' + lc(r.reasons[0]); }
  else if (lv === 'rouge' && p.type === 'box') a.reason = `Rouge : va à la box si tu y tiens, effort ≤ 6/10, ou repos. ${r.reasons[0]}`;
  else if (lv === 'orange') {
    if (p.type === 'run' && p.run && (p.run.kind === 'qualite' || p.run.kind === 'test')) { a.run = RUN.easy(40, 4); a.title = a.run.title; a.dur = a.run.dur; a.goal = a.run.goal; a.reason = `Orange : séance d'allure remplacée par du facile. ${r.reasons[0]}`; }
    else if (p.type === 'renfo') a.reason = `Orange : 1 série de moins, jambes en fessiers seuls. ${r.reasons[0]}`;
    else if (p.type === 'box') a.reason = `Orange : garde 1–2 reps en réserve, pas de record aujourd'hui. ${r.reasons[0]}`;
  }
  if (r.shoulder && p.type === 'renfo') a.reason = (a.reason ? a.reason + ' ' : '') + 'Variantes épaule activées.';
  if (ov.keep && r.level !== 'vert' && r.level !== 'inconnu') a.reason = 'Séance gardée telle que prévue, à ta demande. Écoute tes sensations.';
  return a;
}
const lc = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

export function coachLine(s: AppState, d: ISODate): string {
  const a = adapted(s, d), r = recovery(s, d);
  if (a.type === 'event') return `${a.title} aujourd'hui. Départ prudent, finis plus vite que tu n'as commencé. Note ton résultat ensuite.`;
  if (a.replaced) return `${a.reason} Aujourd'hui : récupération active.`;
  if (r.level === 'inconnu') return a.type === 'rest' ? 'Jour de repos. Une marche compte, le reste non.' : 'Fais ton check-in : il adapte ta séance en 30 secondes.';
  if (a.reason) return a.reason;
  const next = s.events.filter(e => e.status !== 'annulé' && e.date > d && daysBetween(d, e.date) <= 3).sort((x, y) => x.date.localeCompare(y.date))[0];
  if (next && a.type !== 'rest') { const n = daysBetween(d, next.date); return `${next.name} dans ${n} jour${n > 1 ? 's' : ''} : ${lc(a.title)} comme prévu, sans chercher la fatigue.`; }
  if (a.type === 'rest') return "Repos. C'est là que le travail de la semaine se transforme en progrès.";
  if (a.type === 'box') return 'Vert : séance comme prévu. Note ton effort après, c\'est ce qui règle demain.';
  if (a.type === 'run') return `Vert : ${lc(a.title)}. ${a.run?.kind === 'facile' ? 'Si tu ne peux pas parler, ralentis.' : 'Allures cibles dans la séance.'}`;
  if (a.type === 'renfo') return "Vert : renforcement possible. Optionnel : si l'envie n'y est pas, repos.";
  return '';
}

/* ---------- allures ---------- */
export function zones(s: AppState) {
  const r = s.user.ref;
  let p10: number, src: string;
  if (r.k10) { p10 = r.k10 / 10; src = 'ton meilleur 10 km'; }
  else if (r.k5) { p10 = (r.k5 / 5) * 1.0425; src = 'ton test 5 km'; }
  else { p10 = 6 * 60 + 20; src = 'une estimation de départ, à remplacer par Lausanne'; }
  const p5 = p10 / 1.0425;
  const z: Record<Zone, [number, number]> = { easy: [p5 + 75, p5 + 105], seuil: [p5 + 18, p5 + 25], '10k': [p10 - 3, p10 + 3], '5k': [p5 - 3, p5 + 3] };
  return { src, p10, z };
}
export const ZONE_NAME: Record<Zone, string> = { easy: 'Facile · 3–4/10', seuil: 'Seuil · 7/10', '10k': 'Allure 10 km · 7–8/10', '5k': 'Allure 5 km · 8/10' };
export const zoneText = (s: AppState, z: Zone) => { const [a, b] = zones(s).z[z]; return `${mmss(a)}–${mmss(b)} /km`; };

/* ---------- renforcement ---------- */
export const strPhase = (w: number) => (w <= 5 ? 0 : w <= 12 ? 1 : w <= 16 ? 2 : 3);
export interface SetPlan extends Exercise { id: string; nSets: number; repsTxt: string; rirTxt: string }
export interface Block { title: string; leg?: boolean; legSel?: string; items: SetPlan[] }
export function strengthBlocks(s: AppState, d: ISODate, reduced: boolean): Block[] {
  const p = planFor(s, d), w = weekOf(s, d), pi = strPhase(w), log = s.strength[d], short = !!p.short, deload = DELOAD.includes(w);
  const xr = (deload ? 1 : 0) + (reduced ? 1 : 0);
  const addRir = (r: string, k: number) => (!k ? r : r.split('–').map(x => +x + k).join('–'));
  const mk = (id: string): SetPlan => {
    const e = EX[id];
    if (w <= 2) return { id, ...e, nSets: 2, repsTxt: e.reps[0], rirTxt: '4' };
    let n = e.sets[pi]; if (deload) n--; if (reduced) n--; if (short) n = Math.min(n, e.main ? 3 : 2);
    return { id, ...e, nSets: Math.max(1, n), repsTxt: e.reps[pi], rirTxt: addRir(e.rir[pi], xr) };
  };
  const leg = log?.leg || (reduced ? 'f5' : w % 2 ? 'f2' : 'f3');
  const B: Block[] = [
    { title: 'Bloc A · superset', items: [mk('f1'), mk('m2')] },
    { title: 'Bloc B · superset', items: [mk('m1'), mk('m3')] },
    { title: 'Bloc C · superset', items: [mk('m4'), mk('m5')] },
  ];
  if (!short) B.push({ title: 'Bloc D · jambes', leg: true, legSel: leg, items: [mk(leg)] });
  B.push({ title: 'Bloc E · abdos', items: [mk('m7')] });
  if (!short && !reduced) B.push({ title: 'Bonus', items: [mk('m6')] });
  return B;
}
export function bestKg(s: AppState, id: string, before: ISODate): number | null {
  let best: number | null = null;
  Object.entries(s.strength).forEach(([d, l]) => { if (d >= before) return; l.ex?.[id]?.kg?.forEach(v => { const n = num(v); if (n && n > 0 && (best == null || n > best)) best = n; }); });
  return best;
}
export function suggestKg(s: AppState, e: SetPlan, d: ISODate): number | null {
  const last = bestKg(s, e.id, d); if (!last) return null;
  const ds = Object.keys(s.strength).filter(x => x < d).sort().reverse();
  const prev = ds.map(x => s.strength[x].ex?.[e.id]).find(x => x && x.kg.some(v => num(v)));
  if (!prev) return last;
  const top = +String(e.repsTxt).split('–').pop()!;
  const filled = prev.kg.map((k, i) => [k, prev.reps[i]] as const).filter(([k]) => num(k));
  return filled.length && filled.every(([, r]) => (num(r) ?? 0) >= top) ? last + (['f1', 'f3'].includes(e.id) ? 2.5 : 1) : last;
}

/* ---------- progression ---------- */
export function mandatoryStats(s: AppState, from: ISODate, to: ISODate) {
  let planned = 0, done = 0, adaptedN = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) { const a = adapted(s, d); if (a.mandatory && !a.skipped) { planned++; if (doneOn(s, d)) done++; if (a.reason) adaptedN++; } }
  return { planned, done, adaptedN };
}
export const weightSeries = (s: AppState): Measurement[] => s.measurements.filter(m => num(m.weight)).sort((a, b) => a.date.localeCompare(b.date));
export function trend(ms: Measurement[]): number[] { const out: number[] = []; let e: number | null = null; ms.forEach(m => { e = e == null ? m.weight : e + 0.25 * (m.weight - e); out.push(e); }); return out; }
export function weightInsight(s: AppState): string {
  const ms = weightSeries(s); if (ms.length < 2) return 'Pèse-toi chaque lundi : la tendance apparaîtra après quelques semaines. Une pesée isolée ne dit rien.';
  const last = ms[ms.length - 1], first = ms[0], tr = trend(ms);
  const d7 = ms.filter(m => m.date <= addDays(last.date, -6)).pop(), d30 = ms.filter(m => m.date <= addDays(last.date, -28)).pop();
  const out: string[] = []; const dt = last.weight - first.weight;
  out.push(`${dt <= 0 ? '−' : '+'}${Math.abs(dt).toFixed(1).replace('.', ',')} kg depuis le départ.`);
  if (d7 && Math.abs(last.weight - d7.weight) < 0.4) out.push('Peu de variation sur 7 jours.');
  if (d30) { const dm = tr[tr.length - 1] - tr[ms.indexOf(d30)]; out.push(dm < -0.3 ? 'La tendance du mois reste à la baisse.' : dm > 0.3 ? 'La tendance du mois remonte un peu : à lire sur plusieurs semaines.' : 'Tendance stable sur le mois.'); }
  if (d7 && last.weight - d7.weight > 0.6) out.push('Une hausse ponctuelle ne suffit pas à conclure à une reprise de gras : eau, cycle, sel et sommeil pèsent autant.');
  return out.join(' ');
}
export const runsList = (s: AppState): Activity[] => s.activities.filter(a => (a.type === 'running' || a.type === 'course') && a.distanceKm && a.durationMin).sort((a, b) => a.date.localeCompare(b.date));
const pace = (r: Activity) => (r.durationMin! * 60) / r.distanceKm!;
export function comparable(a: Activity, b: Activity) {
  const ga = (a.elevM || 0) / a.distanceKm!, gb = (b.elevM || 0) / b.distanceKm!;
  return Math.abs(ga - gb) <= 5 && Math.abs(a.distanceKm! - b.distanceKm!) <= 0.2 * Math.max(a.distanceKm!, b.distanceKm!) && (a.kind || 'facile') === (b.kind || 'facile');
}
export function runInsight(s: AppState): string {
  const rs = runsList(s).filter(r => r.type === 'running' && (r.kind || 'facile') === 'facile');
  if (rs.length < 3) return 'Pas encore assez de sorties comparables. Les tendances apparaissent à partir de 3 footings faciles sur terrain similaire.';
  const last = rs[rs.length - 1], cmp = rs.slice(0, -1).filter(r => comparable(r, last));
  if (cmp.length < 2) return "Ta dernière sortie n'a pas encore d'équivalent (dénivelé ou distance différents) : pas de comparaison forcée.";
  const avg = cmp.reduce((t, r) => t + pace(r), 0) / cmp.length, diff = avg - pace(last);
  const eff = last.effort != null && cmp.every(r => r.effort != null) ? last.effort - cmp.reduce((t, r) => t + (r.effort || 0), 0) / cmp.length : null;
  if (Math.abs(diff) < 5) return 'Sur des parcours comparables, ton allure facile est stable à effort similaire.';
  if (diff > 0 && (eff == null || eff <= 0.5)) return `Sur des parcours comparables, tu cours ${Math.round(diff)} s/km plus vite à effort similaire.`;
  if (diff < 0) return `Dernière sortie plus lente de ${Math.round(-diff)} s/km${last.elevM ? ` avec ${last.elevM} m de dénivelé` : ''} : pas une régression tant que ça ne se répète pas sur 3 sorties.`;
  return "Allure plus rapide mais effort plus élevé : ce n'est pas encore un progrès d'économie de course.";
}
export function recordEventResult(s: AppState, e: SportEvent) {
  if (!e.result) return;
  if (e.type === 'course' && e.distanceKm) {
    let act = s.activities.find(a => a.eventId === e.id);
    if (!act) { act = { id: 'ev-' + e.id, eventId: e.id, source: 'manuel', date: e.date, type: 'course', title: e.name, complementary: false }; s.activities.push(act); }
    Object.assign(act, { date: e.date, type: 'course', title: e.name, durationMin: e.result.time / 60, distanceKm: e.distanceKm, elevM: e.result.elevM, avgHr: e.result.avgHr, effort: e.result.effort, matched: e.date, complementary: false, kind: 'test' });
    if (e.distanceKm === 10) s.user.ref.k10 = Math.min(...s.events.filter(x => x.result && x.distanceKm === 10).map(x => x.result!.time));
  }
}
export const _internal = { parseISO };
