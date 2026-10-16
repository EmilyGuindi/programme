import { activitiesOn, adapted, doneOn, zones } from './coach';
import { addDays, daysBetween, mmss } from './dates';
import type { Activity, AppState, ISODate, SportEvent } from './types';

/** Prochain événement à préparer (dans les 6 semaines), ou celui du jour. */
export function nextEvent(s: AppState, d: ISODate, horizon = 42): SportEvent | undefined {
  return s.events.filter(e => e.status !== 'annulé' && !e.result && e.date >= d && daysBetween(d, e.date) <= horizon).sort((a, b) => a.date.localeCompare(b.date))[0];
}
/** Événement passé récemment sans débrief. */
export function pendingDebrief(s: AppState, d: ISODate): SportEvent | undefined {
  return s.events.filter(e => e.status !== 'annulé' && e.date < d && daysBetween(e.date, d) <= 5 && !e.result?.feeling).sort((a, b) => b.date.localeCompare(a.date))[0];
}

export interface Readiness { label: string; detail: string; remaining: { date: ISODate; title: string }[] }
/** État de préparation : descriptif, fondé sur la régularité récente et la récupération, jamais un pourcentage inventé. */
export function readiness(s: AppState, ev: SportEvent, d: ISODate): Readiness {
  let planned = 0, done = 0;
  for (let x = addDays(d, -14); x < d; x = addDays(x, 1)) { const a = adapted(s, x); if (a.mandatory && !a.skipped && a.type !== 'event') { planned++; if (doneOn(s, x)) done++; } }
  const remaining: { date: ISODate; title: string }[] = [];
  for (let x = d; x < ev.date; x = addDays(x, 1)) { const a = adapted(s, x); if (a.type !== 'rest' && a.type !== 'event' && !doneOn(s, x)) remaining.push({ date: x, title: (a.replaced || a).title }); }
  const recent = [0, 1, 2].map(i => s.checkins[addDays(d, -i)]).filter(Boolean);
  const tired = recent.filter(c => c!.sleep === 'mal' || (c!.energy ?? 5) <= 2).length;
  let label: string, detail: string;
  if (!planned) { label = 'À construire'; detail = 'Pas encore assez de séances enregistrées pour juger ta préparation.'; }
  else if (done / planned >= 0.75 && tired === 0) { label = 'Sur les rails'; detail = `${done} séance${done > 1 ? 's' : ''} sur ${planned} réalisée${done > 1 ? 's' : ''} ces deux dernières semaines, sans signal de fatigue.`; }
  else if (done / planned >= 0.5) { label = 'Correcte'; detail = `${done} séance${done > 1 ? 's' : ''} sur ${planned} ces deux dernières semaines.${tired ? ' Quelques nuits ou jours difficiles : priorité au repos.' : ''}`; }
  else { label = 'Allégée'; detail = `${done} séance${done > 1 ? 's' : ''} sur ${planned} ces deux dernières semaines. Ce n'est pas un problème : vise une course à l'effort, sans objectif de chrono.`; }
  return { label, detail, remaining };
}

export function taperTips(ev: SportEvent, d: ISODate): string[] {
  const n = daysBetween(d, ev.date);
  if (ev.type === 'ocr') return ['La veille : repos ou marche, rien d\'intense.', 'Prévois des vêtements de rechange et un sac pour les affaires mouillées.', 'Le lendemain : récupération active, pas de séance dure.'];
  if (n > 7) return ['Garde tes séances habituelles, sans chercher de record en box.', 'Dors bien les dix prochains jours : c\'est ce qui compte le plus.', 'Fais au moins une sortie à l\'heure de la course pour t\'habituer.'];
  if (n > 2) return ['Semaine de course : volume réduit, intensité légère.', 'Pas de nouvelles chaussures ni de nouvelle tenue.', 'CrossFit à 7/10 maximum, sans jambes lourdes.'];
  if (n >= 1) return ['Veille : 20 min très faciles avec 3 accélérations, ou repos.', 'Prépare tes affaires ce soir, couche-toi tôt.', 'Hydrate-toi normalement, sans excès.'];
  return ['Arrive 45 min avant le départ.', 'Échauffe-toi 15 min.', 'Pars plus lentement que tu n\'en as envie.'];
}

const CHECK: Record<string, string[]> = {
  course: ['Dossard et épingles (ou ceinture)', 'Chaussures déjà portées en sortie', 'Tenue adaptée à la météo prévue', 'Montre et téléphone chargés', 'Trajet et heure d\'arrivée prévus (45 min avant)', 'Vêtement chaud pour l\'attente', 'Rien de nouveau le jour J'],
  ocr: ['Inscription et pièce d\'identité', 'Chaussures avec accroche, prêtes à être salies', 'Tenue de rechange complète et serviette', 'Sac plastique pour les affaires mouillées', 'Gants si tu en utilises', 'Trajet et heure d\'arrivée prévus'],
  'hyrox-compet': ['Billet et heure de vague', 'Chaussures de course et tenue testées', 'Gants pour le sled si tu en utilises', 'Montre chargée', 'Arriver 60 min avant la vague'],
  autre: ['Inscription confirmée', 'Tenue et chaussures testées', 'Trajet prévu'],
};
export const checklistFor = (ev: SportEvent) => CHECK[ev.type] || CHECK.autre;

export interface Strategy { mode: 'allure' | 'effort'; target?: string; basis: string; plan: { km: string; pace?: string; cue: string }[]; start: string; manage: string; warmup: string[]; planB: string[] }
/** Stratégie : allures uniquement si une vraie référence existe (résultat de course ou test). Sinon, à l'effort. */
export function strategy(s: AppState, ev: SportEvent): Strategy | null {
  if (ev.type !== 'course' || !ev.distanceKm) return null;
  const z = zones(s); const hasRef = !!(s.user.ref.k10 || s.user.ref.k5);
  const warmup = ['10 min de footing très lent', 'Montées de genoux et talons-fesses, 2 × 20 m', '3 accélérations de 15 s jusqu\'à l\'allure de course', 'Rejoins le sas 5 à 10 min avant le départ, reste en mouvement'];
  const n = Math.round(ev.distanceKm);
  if (!hasRef) {
    const plan = n >= 8 ? [
      { km: `1–2`, cue: 'Effort 6/10 : tu dois pouvoir dire une phrase. Laisse partir les autres.' },
      { km: `3–${n - 3}`, cue: 'Effort 7/10 : respiration appuyée mais régulière. Trouve ton rythme et tiens-le.' },
      { km: `${n - 2}–${n}`, cue: 'Effort 8/10 et plus : c\'est ici que tu accélères si tu en as encore.' },
    ] : [{ km: '1', cue: 'Effort 7/10, départ contrôlé.' }, { km: `2–${n}`, cue: 'Effort 8/10, accélère sur le dernier kilomètre.' }];
    return { mode: 'effort', basis: 'Pas encore de chrono de référence fiable : cette course se gère à l\'effort, et elle deviendra ta référence.', plan, start: 'Le piège n°1 : partir trop vite dans l\'euphorie du départ. Les 2 premiers km doivent te sembler faciles.', manage: 'En montée, garde l\'effort et accepte de ralentir. En descente, relâche et laisse rouler.', warmup, planB: ['Jambes lourdes dès le départ : reste à 6–7/10 tout du long, l\'objectif devient de finir bien.', 'Chaleur ou vent fort : oublie le rythme, cours aux sensations.', 'Point de côté : ralentis, expire fort, reprends progressivement.'] };
  }
  const p = z.p10; // allure 10 km de référence, issue d'un vrai résultat ou test
  const pace = (delta: number) => mmss(p + delta);
  const plan = [
    { km: '1', pace: pace(+6), cue: 'Volontairement un peu plus lent que l\'allure cible.' },
    { km: `2–${n - 2}`, pace: pace(0), cue: 'Allure cible, régulière. Vérifie ta montre au kilomètre, pas en continu.' },
    { km: `${n - 1}–${n}`, pace: `${pace(-6)} ou plus vite`, cue: 'Si tu te sens bien, accélère progressivement.' },
  ];
  return { mode: 'allure', target: `${mmss(p)} /km, soit environ ${clockShort(p * ev.distanceKm)}`, basis: `Basé sur ${z.src}. Objectif : faire au moins aussi bien, sur un parcours qui peut être différent.`, plan, start: 'Les 500 premiers mètres sont souvent 15 à 20 s/km trop rapides : surveille ta montre dès le départ.', manage: 'Sur un parcours vallonné, raisonne à l\'effort en montée et rattrape en descente, sans t\'affoler sur l\'allure.', warmup, planB: [`Si l'allure cible te semble trop dure avant le km 3, passe à ${pace(+10)} et tiens-la.`, 'Chaleur : ralentis de 10 à 15 s/km dès le départ.', 'Sensations excellentes au km 7 : accélère, mais pas avant.'] };
}
const clockShort = (sec: number) => { sec = Math.round(sec); const m = Math.floor(sec / 60), r = sec % 60; return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min ${String(r).padStart(2, '0')}`; };

export function eventActivity(s: AppState, ev: SportEvent): Activity | undefined { return s.activities.find(a => a.eventId === ev.id) || activitiesOn(s, ev.date).find(a => a.type === 'course'); }

/** Analyse factuelle après la course. */
export function raceAnalysis(s: AppState, ev: SportEvent): string[] {
  const out: string[] = []; const r = ev.result; if (!r) return out;
  if (ev.distanceKm) out.push(`${mmss(r.time / ev.distanceKm)} /km de moyenne sur ${String(ev.distanceKm).replace('.', ',')} km.`);
  const act = eventActivity(s, ev);
  if (act?.laps && act.laps.length >= 4) {
    const half = Math.floor(act.laps.length / 2); const t = (ls: typeof act.laps) => ls!.reduce((x, l) => x + l.s, 0) / ls!.reduce((x, l) => x + l.km, 0);
    const a = t(act.laps.slice(0, half)), b = t(act.laps.slice(half)); const diff = Math.round(b - a);
    out.push(Math.abs(diff) < 4 ? 'Allure très régulière entre la première et la seconde moitié.' : diff < 0 ? `Seconde moitié plus rapide de ${-diff} s/km : course bien gérée.` : `Seconde moitié plus lente de ${diff} s/km : départ probablement un peu rapide.`);
  }
  const prev = s.events.filter(e => e.id !== ev.id && e.result && e.distanceKm === ev.distanceKm && e.date < ev.date).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (prev && ev.distanceKm) {
    const d = Math.round((r.time - prev.result!.time) / ev.distanceKm);
    const elevNote = r.elevM != null && prev.result!.elevM != null && Math.abs(r.elevM - prev.result!.elevM) > 40 ? ` Attention : ${r.elevM} m de dénivelé contre ${prev.result!.elevM} m, les parcours ne sont pas directement comparables.` : '';
    out.push(`${Math.abs(d) < 2 ? 'Même allure qu\'à' : d < 0 ? `${-d} s/km plus rapide qu'à` : `${d} s/km plus lent qu'à`} ${prev.name}.${elevNote}`);
  } else if (ev.type === 'course') out.push('C\'est ta première référence sur cette distance : les prochaines courses s\'y compareront.');
  if (r.pacing === 'trop-vite') out.push('Tu as senti un départ trop rapide : à la prochaine course, vise 5 s/km plus lent sur le premier kilomètre.');
  return out;
}
