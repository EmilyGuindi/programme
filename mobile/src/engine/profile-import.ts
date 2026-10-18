import { clock, parseTime, uid } from './dates';
import type { Activity, ActivityType, AppState, ISODate, SportEvent } from './types';

/* ============================================================
   « Importer mon profil sportif » : JSON (schéma byynd-profile/1), Markdown structuré ou texte « clé : valeur ».
   Le contenu importé est une donnée, jamais une consigne : aucun texte n'est interprété comme une instruction.
   Rien n'est écrit sans confirmation, et une donnée importée n'écrase jamais une activité Strava ou plus récente.
   ============================================================ */

export const PROFILE_SCHEMA = 'byynd-profile/1';
export interface ImportedProfile {
  goals?: { run?: string; weightTarget?: number; physique?: string };
  heightCm?: number;
  records?: { distanceKm: number; time: string; date?: ISODate }[];
  events?: { name: string; date: ISODate; distanceKm?: number; type?: SportEvent['type']; priority?: SportEvent['priority']; goal?: string }[];
  history?: { date: ISODate; type: ActivityType; km?: number; min?: number; hr?: number; effort?: number }[];
  constraints?: string;
}
export const PROMPT_CHATGPT = `Résume mon profil sportif pour l'application BYYND. Réponds uniquement avec un bloc JSON valide, sans commentaire, au format suivant :
{
  "schema": "byynd-profile/1",
  "goals": { "run": "objectif course en une phrase", "weightTarget": 60, "physique": "objectif physique en une phrase" },
  "heightCm": 165,
  "records": [ { "distanceKm": 10, "time": "58:30", "date": "2026-10-25" } ],
  "events": [ { "name": "nom de la course", "date": "AAAA-MM-JJ", "distanceKm": 10, "type": "course", "priority": "objectif", "goal": "objectif" } ],
  "history": [ { "date": "AAAA-MM-JJ", "type": "running", "km": 8, "min": 50, "hr": 150, "effort": 5 } ],
  "constraints": "contraintes : jours disponibles, voyages, gênes"
}
N'invente rien : laisse de côté ce que tu ne sais pas. Types possibles : running, course, crossfit, hyrox, renfo, marche, autre.`;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES: ActivityType[] = ['crossfit', 'hyrox', 'hyrox-simu', 'hyrox-compet', 'running', 'course', 'renfo', 'marche', 'autre'];
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : undefined);
const numIn = (v: unknown, lo: number, hi: number) => { const n = typeof v === 'number' ? v : typeof v === 'string' ? +v.replace(',', '.') : NaN; return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined; };
const dateOk = (v: unknown) => (typeof v === 'string' && DATE.test(v) && !isNaN(Date.parse(v)) ? v : undefined);

/** Lecture tolérante, validation stricte : chaque champ est vérifié, le reste est ignoré et signalé. */
export function parseProfile(text: string): { profile: ImportedProfile; warnings: string[] } | { error: string } {
  const t = text.trim().slice(0, 200_000); if (!t) return { error: 'Rien à importer.' };
  const warnings: string[] = []; let raw: any = null;
  const jsonText = t.startsWith('{') ? t : t.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1];
  if (jsonText) { try { raw = JSON.parse(jsonText); } catch { return { error: 'JSON illisible : vérifie qu\'il est complet (accolades, virgules).' }; } }
  else raw = fromMarkdown(t, warnings);
  if (raw.schema && raw.schema !== PROFILE_SCHEMA) warnings.push(`Schéma « ${String(raw.schema).slice(0, 30)} » inconnu : lecture au mieux.`);
  const p: ImportedProfile = {};
  const g = raw.goals || {}; const goals = { run: str(g.run), weightTarget: numIn(g.weightTarget, 30, 200), physique: str(g.physique, 300) };
  if (goals.run || goals.weightTarget || goals.physique) p.goals = goals;
  p.heightCm = numIn(raw.heightCm, 100, 230);
  const arr = (v: unknown, name: string) => { if (v == null) return []; if (!Array.isArray(v)) { warnings.push(`« ${name} » doit être une liste : ignoré.`); return []; } return v.slice(0, 500); };
  p.records = arr(raw.records, 'records').flatMap((r: any) => { const km = numIn(r?.distanceKm, 0.4, 100); const time = str(r?.time, 12); if (!km || !time || parseTime(time) == null) { warnings.push('Un record sans distance ou temps valide a été ignoré.'); return []; } return [{ distanceKm: km, time, date: dateOk(r.date) }]; });
  p.events = arr(raw.events, 'events').flatMap((e: any) => { const name = str(e?.name, 80); const date = dateOk(e?.date); if (!name || !date) { warnings.push('Une compétition sans nom ou date valide a été ignorée.'); return []; }
    return [{ name, date, distanceKm: numIn(e.distanceKm, 0.1, 250), type: ['course', 'ocr', 'hyrox-compet', 'autre'].includes(e.type) ? e.type : 'course', priority: ['participation', 'repère', 'objectif'].includes(e.priority) ? e.priority : 'participation', goal: str(e.goal, 120) }]; });
  p.history = arr(raw.history, 'history').flatMap((h: any) => { const date = dateOk(h?.date); const type = TYPES.includes(h?.type) ? h.type : null; if (!date || !type) { warnings.push('Une séance sans date ou type reconnu a été ignorée.'); return []; }
    return [{ date, type, km: numIn(h.km, 0, 300), min: numIn(h.min, 1, 1000), hr: numIn(h.hr, 40, 230), effort: numIn(h.effort, 1, 10) }]; });
  p.constraints = str(raw.constraints, 600);
  return { profile: p, warnings: [...new Set(warnings)] };
}
/** Markdown / texte : lignes « clé : valeur » et listes de compétitions « - Nom, AAAA-MM-JJ, 10 km ». */
function fromMarkdown(t: string, warnings: string[]) {
  const out: any = { goals: {}, events: [], records: [], history: [] };
  for (const line of t.split('\n')) {
    const l = line.replace(/^[-*#>\s]+/, '').trim(); if (!l) continue;
    const kv = l.match(/^([^:]{2,40}):\s*(.+)$/); const k = kv ? kv[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') : '';
    const d = l.match(/(\d{4}-\d{2}-\d{2})/)?.[1]; const km = l.match(/(\d+(?:[.,]\d+)?)\s?km/)?.[1];
    if (kv && /objectif.*(course|running)/.test(k)) out.goals.run = kv[2];
    else if (kv && /poids/.test(k)) out.goals.weightTarget = kv[2].match(/\d+(?:[.,]\d+)?/)?.[0];
    else if (kv && /objectif.*(physique|corps)/.test(k)) out.goals.physique = kv[2];
    else if (kv && /taille/.test(k)) out.heightCm = kv[2].match(/\d+/)?.[0];
    else if (kv && /contrainte|disponibilite/.test(k)) out.constraints = kv[2];
    else if (kv && /record/.test(k) && km) out.records.push({ distanceKm: km, time: kv[2].match(/\d{1,2}[:h']\d{2}(?::\d{2})?/)?.[0], date: d });
    else if (d && /course|km|trail|hyrox|marathon/i.test(l)) out.events.push({ name: l.split(',')[0].replace(d, '').trim(), date: d, distanceKm: km });
  }
  if (!Object.keys(out.goals).length && !out.events.length && !out.records.length) warnings.push('Peu d\'éléments reconnus : préfère le format JSON (bouton « Prompt pour ChatGPT »).');
  return out;
}

/* ---------- Différences avec les données actuelles ---------- */
export interface Change { id: string; label: string; current: string; incoming: string; kind: 'add' | 'update' | 'skip' | 'conflict'; reason?: string; apply: (s: AppState) => void }
export function diffProfile(s: AppState, p: ImportedProfile): Change[] {
  const out: Change[] = []; const fmt = (v: unknown) => (v == null || v === '' ? '—' : String(v));
  const goal = (key: 'run' | 'weightTarget' | 'physique', label: string) => { const v = p.goals?.[key]; if (v == null) return; const cur = s.user.goals[key];
    if (String(cur) === String(v)) return;
    out.push({ id: `goal-${key}`, label, current: fmt(cur), incoming: fmt(v), kind: 'update', reason: 'Ton objectif actuel sera remplacé si tu coches.', apply: st => { (st.user.goals as any)[key] = v; } }); };
  goal('run', 'Objectif course'); goal('weightTarget', 'Poids souhaité (kg)'); goal('physique', 'Objectif physique');
  if (p.heightCm && p.heightCm !== s.user.height) out.push({ id: 'height', label: 'Taille (cm)', current: fmt(s.user.height), incoming: fmt(p.heightCm), kind: 'update', apply: st => { st.user.height = p.heightCm!; } });
  for (const e of p.events || []) {
    const same = s.events.find(x => x.name.toLowerCase() === e.name.toLowerCase());
    if (same && same.date === e.date) continue;
    if (same) { out.push({ id: `ev-${e.name}`, label: `Compétition : ${e.name}`, current: same.date, incoming: e.date, kind: 'conflict', reason: 'Même nom, date différente : garde la tienne sauf si l\'import est plus à jour.', apply: st => { const x = st.events.find(y => y.id === same.id); if (x && x.status === 'prévu') x.date = e.date; } }); continue; }
    out.push({ id: `ev-${e.name}-${e.date}`, label: `Compétition : ${e.name}`, current: '—', incoming: `${e.date}${e.distanceKm ? `, ${e.distanceKm} km` : ''}`, kind: 'add', apply: st => { st.events.push({ id: 'ev-' + uid(), name: e.name, date: e.date, distanceKm: e.distanceKm ?? null, type: e.type || 'course', priority: e.priority || 'participation', goal: e.goal, status: 'prévu' }); } });
  }
  for (const r of p.records || []) {
    const sec = parseTime(r.time)!; const k = Math.abs(r.distanceKm - 10) < 0.3 ? 'k10' : Math.abs(r.distanceKm - 5) < 0.2 ? 'k5' : null; if (!k) continue;
    const cur = s.user.ref[k];
    if (cur && cur <= sec) { out.push({ id: `rec-${k}`, label: `Référence ${k === 'k10' ? '10 km' : '5 km'}`, current: clock(cur), incoming: r.time, kind: 'skip', reason: 'Ta référence actuelle est meilleure ou mesurée : elle est gardée.', apply: () => {} }); continue; }
    out.push({ id: `rec-${k}`, label: `Référence ${k === 'k10' ? '10 km' : '5 km'}`, current: cur ? clock(cur) : '—', incoming: r.time, kind: cur ? 'conflict' : 'add', reason: cur ? 'Plus rapide que ta référence actuelle : vérifie qu\'elle est bien mesurée.' : undefined, apply: st => { st.user.ref[k] = sec; } });
  }
  const hist = p.history || [];
  const dup = hist.filter(h => s.activities.some(a => a.date === h.date && (a.source === 'strava' || a.type === h.type)));
  const add = hist.filter(h => !dup.includes(h));
  if (dup.length) out.push({ id: 'hist-skip', label: `${dup.length} séance${dup.length > 1 ? 's' : ''} déjà présente${dup.length > 1 ? 's' : ''}`, current: 'Strava ou saisie', incoming: 'import', kind: 'skip', reason: 'Tes activités existantes (Strava comprises) sont gardées : l\'import ne les remplace jamais.', apply: () => {} });
  if (add.length) out.push({ id: 'hist-add', label: `${add.length} séance${add.length > 1 ? 's' : ''} passée${add.length > 1 ? 's' : ''}`, current: '—', incoming: `du ${add.map(h => h.date).sort()[0]} au ${add.map(h => h.date).sort().pop()}`, kind: 'add', reason: 'Ajoutées comme saisies (source : import), sans valider de séance du programme.',
    apply: st => { for (const h of add) { if (st.activities.some(a => a.date === h.date && (a.source === 'strava' || a.type === h.type))) continue; const a: Activity = { id: 'imp-' + uid(), date: h.date, type: h.type, title: h.type === 'running' ? 'Course (import)' : `${h.type.charAt(0).toUpperCase()}${h.type.slice(1)} (import)`, distanceKm: h.km ?? null, durationMin: h.min ?? null, avgHr: h.hr ?? null, effort: h.effort ?? null, source: 'manuel', complementary: true, matched: null, notes: 'Importé depuis le profil sportif' }; st.activities.push(a); } } });
  if (p.constraints) out.push({ id: 'constraints', label: 'Contraintes', current: s.user.constraints || '—', incoming: p.constraints, kind: 'add', reason: 'Gardées comme note, reprises à la création de ton prochain programme.', apply: st => { st.user.constraints = p.constraints; } });
  return out;
}
/** Applique les changements cochés (dans update()). Les « skip » ne font jamais rien. */
export function applyChanges(st: AppState, changes: Change[], selected: Set<string>) { for (const c of changes) if (c.kind !== 'skip' && selected.has(c.id)) c.apply(st); }
