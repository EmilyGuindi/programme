import type { RunSession, Zone } from './types';

const st = (text: string, zone: Zone | null = null) => ({ text, zone });

export const RUN = {
  easy: (min: number, ld = 0): RunSession => ({ kind: 'facile', title: `Footing facile ${min} min`, dur: `${min + (ld ? 4 : 0)} min`,
    goal: "Endurance fondamentale : construire la base aérobie sans fatigue.",
    steps: [st("5 min très facile en guise d'échauffement", 'easy'), st(`${min - 5} min facile, respiration confortable`, 'easy'),
      ...(ld ? [st(`${ld} lignes droites de 15 s, récup 45 s en marchant`)] : []), st('3 min de marche pour finir')] }),
  recov: (min: number): RunSession => ({ kind: 'recup', title: `Footing de récupération ${min} min`, dur: `${min} min`,
    goal: 'Relancer la circulation après la course, sans aucune intensité.', steps: [st(`${min} min très facile, marche autorisée à tout moment`, 'easy')] }),
  sharp: (): RunSession => ({ kind: 'affutage', title: 'Affûtage 20 min', dur: '20 min', goal: "Garder les jambes vives la veille d'une course, sans fatigue.",
    steps: [st('12 min très facile', 'easy'), st('3 accélérations de 15 s, récup 1 min de marche'), st('5 min facile', 'easy')] }),
  rappel: (): RunSession => ({ kind: 'rappel', title: "Rappel d'allure 10 km", dur: '40 min', goal: "Rappeler l'allure de course sans entamer la fraîcheur.",
    steps: [st('12 min facile', 'easy'), st('4 × 1 min à allure 10 km, récup 2 min de trot', '10k'), st('10 min facile', 'easy'), st('3 min de marche')] }),
  seuil: (n: number, min: number, rec: number): RunSession => ({ kind: 'qualite', title: `Seuil : ${n} × ${min} min`, dur: `${Math.round(12 + n * min + (n - 1) * rec + 8)} min`,
    goal: 'Endurance à allure soutenue : tenir longtemps juste sous le seuil.',
    steps: [st('12 min facile + 3 accélérations', 'easy'), st(`${n} × ${min} min allure seuil, récup ${String(rec).replace('.', ',')} min de trot`, 'seuil'), st('8 min facile', 'easy')] }),
  k10: (txt: string, total: number): RunSession => ({ kind: 'qualite', title: `Allure 10 km : ${txt}`, dur: `${total} min`,
    goal: "Endurance spécifique : tenir l'allure cible du 10 km.",
    steps: [st('12 min facile + 3 accélérations', 'easy'), st(`${txt} à allure 10 km, récup 2 min de trot`, '10k'), st('8 min facile', 'easy')] }),
  test5: (): RunSession => ({ kind: 'test', title: 'Test 5 km', dur: '40 min', goal: 'Repère comparable : même parcours plat, effort maximal régulier.',
    steps: [st('12 min facile + 3 accélérations', 'easy'), st('5 km au chrono, régulier du début à la fin'), st('5 min de marche ou trot')] }),
  test10: (): RunSession => ({ kind: 'test', title: 'Test 10 km', dur: '70 min', goal: 'Bilan de mi-février : comparer à Lausanne et Athènes.',
    steps: [st('12 min facile + 3 accélérations', 'easy'), st('10 km au chrono, départ prudent, 2e moitié plus rapide', '10k'), st('5 min de marche')] }),
  tempo: (): RunSession => ({ kind: 'qualite', title: 'Tempo 15 min', dur: '40 min', goal: 'Allure soutenue continue, sans aller jusqu\'au seuil.',
    steps: [st('12 min facile', 'easy'), st('15 min à allure tempo (6–7/10)', 'seuil'), st('8 min facile', 'easy')] }),
};

/** Séance clé du mercredi, par semaine du cycle (hors semaines fixées par les événements). */
export const WED: Record<number, RunSession> = {
  5: RUN.easy(40), 6: RUN.easy(45, 4), 7: RUN.easy(50, 6), 8: RUN.seuil(3, 5, 2), 9: RUN.easy(45, 6), 10: RUN.test5(),
  11: RUN.seuil(4, 6, 1.5), 12: RUN.easy(40), 13: RUN.seuil(3, 8, 2), 14: RUN.easy(50, 6), 15: RUN.test5(), 16: RUN.k10('3 × 8 min', 46),
  17: RUN.easy(50, 6), 18: RUN.test10(), 19: RUN.k10('4 × 1 km', 48), 20: RUN.easy(40),
};

type Fixed =
  | { type: 'box' | 'rest' | 'recup'; title: string; dur?: string; goal?: string; note?: string }
  | { type: 'run'; run: RunSession; optional?: boolean; note?: string }
  | { type: 'renfo'; short: boolean };

/** Semaines 1 à 5, recalculées autour de MUDGIRL, Lausanne et Athènes. */
export const FIXED: Record<string, Fixed> = {
  '2026-10-14': { type: 'recup', title: 'Marche', dur: '40 min', goal: 'Démarrage du programme, en douceur.' },
  '2026-10-15': { type: 'box', title: 'CrossFit', note: 'Pas de jambes lourdes : MUDGIRL dans 2 jours.' },
  '2026-10-16': { type: 'rest', title: 'Repos', note: 'Veille de MUDGIRL.' },
  '2026-10-18': { type: 'recup', title: 'Récupération active', dur: '30 min', goal: "Marche 30 min et 10 min de mobilité. Rien d'autre après la course à obstacles." },
  '2026-10-20': { type: 'box', title: 'CrossFit, effort ≤ 7/10', note: 'Semaine de course : garde 2 reps en réserve, pas de jambes lourdes.' },
  '2026-10-21': { type: 'run', run: RUN.easy(35, 4) },
  '2026-10-22': { type: 'box', title: 'CrossFit léger', note: 'Effort ≤ 7/10, haut du corps si tu as le choix. Lausanne dans 3 jours.' },
  '2026-10-24': { type: 'run', run: RUN.sharp(), optional: true, note: 'Ou repos complet : les deux sont bons.' },
  '2026-10-26': { type: 'rest', title: 'Repos, marche', note: 'Lendemain de course.' },
  '2026-10-27': { type: 'box', title: 'CrossFit léger', note: '48 h après Lausanne : effort ≤ 7/10.' },
  '2026-10-28': { type: 'run', run: RUN.recov(35) },
  '2026-10-29': { type: 'box', title: 'CrossFit' },
  '2026-10-31': { type: 'box', title: 'Cours HYROX, effort libre', note: 'Pas à fond : Athènes dans 8 jours.' },
  '2026-11-01': { type: 'renfo', short: true },
  '2026-11-03': { type: 'box', title: 'CrossFit', note: 'Pas de jambes lourdes cette semaine.' },
  '2026-11-04': { type: 'run', run: RUN.rappel() },
  '2026-11-05': { type: 'box', title: 'CrossFit léger, haut du corps', note: 'Dernière séance avant Athènes.' },
  '2026-11-06': { type: 'rest', title: 'Repos, voyage' },
  '2026-11-07': { type: 'run', run: RUN.sharp(), note: 'Sur place, 20 min, rien de plus.' },
  '2026-11-10': { type: 'box', title: 'CrossFit léger', note: '48 h après Athènes.' },
  '2026-11-14': { type: 'box', title: 'Cours HYROX, effort libre' },
  '2026-11-15': { type: 'renfo', short: true },
};

export interface Exercise { name: string; main: boolean; sets: number[]; reps: string[]; rir: string[]; rest: string; tech: string; alt: string; shoulder: string }
export const EX: Record<string, Exercise> = {
  m1: { name: 'Développé landmine, demi-genou', main: true, sets: [3, 3, 3, 4], reps: ['8–10', '8–10', '6–8', '6–8'], rir: ['3', '2', '2', '1–2'], rest: '2 min', tech: 'Côtes basses, fessier serré du côté du genou au sol. Pousse vers le haut et légèrement en avant, coude à ~45°.', alt: 'Développé haltères assis prise neutre ; pompes déclinées.', shoulder: 'Amplitude réduite (stop au front), floor press prise neutre ou pompes inclinées.' },
  m2: { name: 'Tirage vertical prise neutre', main: true, sets: [3, 3, 4, 4], reps: ['8–10', '8–10', '6–10', '6–8'], rir: ['3', '2', '1–2', '1–2'], rest: '90 s', tech: "Descends d'abord les épaules, puis coudes vers les hanches. Remontée contrôlée 2 s.", alt: 'Tractions assistées, négatives 5 s, tirage un bras poulie.', shoulder: "Prise neutre, pas d'extension complète au-dessus de la tête." },
  m3: { name: 'Rowing buste appuyé haltères', main: true, sets: [3, 3, 3, 4], reps: ['10–12', '10–12', '8–12', '8–10'], rir: ['3', '2', '2', '1–2'], rest: '90 s', tech: 'Banc incliné ~30°. Coudes vers les poches arrière, omoplates serrées 1 s.', alt: 'Rowing unilatéral haltère, rowing poulie basse.', shoulder: 'Charge réduite, coudes près du corps.' },
  m4: { name: 'Élévations latérales', main: true, sets: [3, 3, 4, 4], reps: ['12–15', '12–20', '12–20', '10–15'], rir: ['2', '1–2', '1', '1'], rest: '60 s', tech: "Bras ~30° en avant, jusqu'à hauteur d'épaule, sans élan.", alt: 'Poulie basse un bras, élastique.', shoulder: 'Stop à 60–70°, plus léger, tempo lent.' },
  m5: { name: 'Face pull', main: false, sets: [2, 2, 3, 3], reps: ['15–20', '15–20', '15–20', '12–15'], rir: ['2', '2', '1–2', '1–2'], rest: '60 s', tech: 'Corde à hauteur des yeux, tire vers le front, pouces vers l\'arrière.', alt: 'Oiseau buste appuyé, pull-apart.', shoulder: "Garde-le, léger : c'est un exercice de protection." },
  m6: { name: 'Superset bras : curl incliné + triceps poulie', main: false, sets: [2, 2, 3, 3], reps: ['10–12', '10–12', '10–12', '8–12'], rir: ['2', '2', '1–2', '1'], rest: '60 s', tech: 'Curl 45° coudes fixes, puis extension corde coudes collés.', alt: 'Curl marteau, extension élastique.', shoulder: "Pas d'extension au-dessus de la tête." },
  m7: { name: 'Abdos : roue (ou dead bug) + Pallof', main: false, sets: [3, 3, 3, 3], reps: ['dead bug 8/côté + Pallof 10/côté', 'roue 6–8 + Pallof 10/côté', 'roue 8–10 + Pallof 12/côté', 'roue 10 + Pallof 12/côté'], rir: ['2', '2', '1–2', '1–2'], rest: '60 s', tech: 'Roue : bassin en rétroversion, côtes basses. Pallof : résiste 2 s.', alt: 'Gainage latéral + hollow hold, body saw.', shoulder: 'Dead bug lesté à la place de la roue.' },
  f1: { name: 'Hip thrust barre', main: true, sets: [3, 4, 4, 4], reps: ['8–10', '6–10', '6–8', '5–8'], rir: ['3', '2', '2', '1–2'], rest: '2 min', tech: 'Omoplates sur le banc, tibias verticaux en haut, menton rentré, bloque 1 s sans cambrer.', alt: 'Machine, pont fessier barre au sol, unilatéral.', shoulder: '' },
  f2: { name: 'Fentes bulgares haltères', main: true, sets: [2, 3, 3, 3], reps: ['8–10', '8–10', '8–12', '6–10'], rir: ['3', '3', '2–3', '2'], rest: '90 s / jambe', tech: 'Buste légèrement penché, descente 2 s, genou dans l\'axe. Jambe faible d\'abord.', alt: 'Split squat, fentes arrière, step-up.', shoulder: 'Un haltère en goblet ou gilet lesté.' },
  f3: { name: 'Soulevé de terre roumain', main: true, sets: [2, 3, 3, 3], reps: ['8', '8', '6–8', '6–8'], rir: ['3', '3', '2–3', '2–3'], rest: '2 min', tech: 'Genoux fixes, hanches qui reculent, barre collée, jusqu\'à mi-tibia.', alt: 'RDL haltères, extension 45°.', shoulder: 'Sangles autorisées.' },
  f4: { name: 'Goblet squat talons surélevés', main: false, sets: [2, 2, 3, 3], reps: ['12–15', '12–15', '10–15', '10–12'], rir: ['3', '2', '2', '2'], rest: '75 s', tech: 'Cale 2–3 cm, buste droit, genoux au-dessus des orteils.', alt: 'Leg extension, presse pieds bas.', shoulder: "Leg extension si tenir l'haltère gêne." },
  f5: { name: 'Abduction de hanche', main: false, sets: [2, 2, 3, 3], reps: ['15–20', '15–20', '15–20', '12–15'], rir: ['1–2', '1–2', '1', '1'], rest: '45 s', tech: 'Buste penché en avant, pause 1 s en ouverture.', alt: 'Élastique au-dessus des genoux.', shoulder: '' },
};
export const LEGS: [string, string][] = [['f2', 'Fentes'], ['f3', 'RDL'], ['f4', 'Goblet'], ['f5', 'Fessiers']];
export const WARMUP = ['4 min rameur ou vélo, facile', 'Rotations externes élastique 2×12', 'Pull-aparts 2×15', 'Pont fessier 2×12', 'Charnière au bâton 1×10', 'Dead bug 1×8 par côté', '1 série légère de hip thrust et de tirage'];
