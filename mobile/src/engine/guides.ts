/** Contenu pédagogique des séances faites hors box. Tout est explicite : quoi, comment, pourquoi, quoi ressentir. */
import type { Zone } from './types';

export interface Move { name: string; dose: string; how: string[]; why?: string; feel?: string; mistakes?: string[] }

/* ---------- Running ---------- */
export const RUN_WARMUP: Move[] = [
  { name: 'Footing très lent', dose: '5 à 10 min', how: ['Pars beaucoup plus lentement que tu ne le penses : tu dois pouvoir chanter.', 'Petites foulées, bras relâchés.'], why: 'Monter la température des muscles et le rythme cardiaque progressivement.' },
  { name: 'Montées de genoux', dose: '2 × 20 m', how: ['Sur place qui avance doucement, genoux à hauteur de hanches.', 'Pose l\'avant du pied sous ton bassin, pas devant.', 'Bras en opposition, coudes à 90°.'], why: 'Réveille les fléchisseurs de hanche et apprend à poser le pied sous toi.' },
  { name: 'Talons-fesses', dose: '2 × 20 m', how: ['Ramène le talon vers la fesse, rapide et léger.', 'Le genou reste pointé vers le sol, il ne monte pas.'], why: 'Active les ischio-jambiers et la fréquence de pas.' },
  { name: 'Pas chassés', dose: '2 × 20 m, une fois de chaque côté', how: ['De profil, pieds qui se rejoignent sans se croiser.', 'Reste sur l\'avant du pied.'], why: 'Stabilité des chevilles et des hanches.' },
  { name: 'Accélérations progressives', dose: '3 × 60 à 80 m, retour en marchant', how: ['Commence en footing, accélère jusqu\'à environ 80 % de ta vitesse max, puis relâche.', 'Garde le buste droit, regarde loin devant.'], why: 'Prépare le cœur et les jambes à l\'allure de la séance.' },
];
export const RUN_COOLDOWN: Move[] = [
  { name: 'Retour au calme', dose: '5 à 10 min', how: ['Trot très lent puis marche.', 'Laisse la respiration redescendre complètement.'], why: 'Faire redescendre le cœur doucement et éliminer la fatigue.' },
  { name: 'Mollets contre un mur', dose: '30 s par jambe', how: ['Mains au mur, une jambe tendue derrière, talon au sol.', 'Avance le bassin jusqu\'à sentir l\'étirement dans le mollet.'], feel: 'Tiraillement doux, jamais de douleur.' },
  { name: 'Fléchisseurs de hanche (fente basse)', dose: '30 s par côté', how: ['Un genou au sol, l\'autre pied devant, genou à 90°.', 'Serre la fesse du côté du genou au sol et avance légèrement le bassin.'], feel: 'Étirement à l\'avant de la hanche du genou posé.' },
  { name: 'Ischio-jambiers', dose: '30 s par jambe', how: ['Talon posé sur une marche ou un banc bas, jambe presque tendue.', 'Penche le buste vers l\'avant dos droit, sans arrondir.'], feel: 'Arrière de la cuisse.' },
  { name: 'Fessiers (figure 4)', dose: '30 s par côté', how: ['Allongée sur le dos, cheville droite posée sur le genou gauche.', 'Ramène la jambe gauche vers toi.'], feel: 'Fessier droit.' },
];
export const ZONE_GUIDE: Record<Zone, { feel: string; talk: string; breath: string; tip: string }> = {
  easy: { feel: 'Effort 3–4 sur 10 : tu pourrais continuer très longtemps.', talk: 'Tu parles en phrases complètes sans chercher ton souffle.', breath: 'Respiration calme, régulière, souvent possible par le nez.', tip: 'En montée, ralentis ou marche : on garde l\'effort, pas l\'allure. C\'est la zone qui construit ta base, et c\'est normal qu\'elle te paraisse « trop lente ».' },
  seuil: { feel: 'Effort 7 sur 10 : soutenu mais contrôlé.', talk: 'Phrases courtes, quelques mots à la fois.', breath: 'Respiration profonde et rapide, mais rythmée.', tip: 'Tu dois finir la dernière répétition en te disant que tu aurais pu en faire une de plus. Si tu termines à bout, tu es partie trop vite.' },
  '10k': { feel: 'Effort 7–8 sur 10.', talk: 'Deux ou trois mots, pas plus.', breath: 'Rapide et appuyée.', tip: 'Cherche la régularité : chaque répétition à la même allure. Démarre légèrement en dessous et ajuste.' },
  '5k': { feel: 'Effort 8 sur 10 : dur.', talk: 'Un mot à la fois.', breath: 'Haletante en fin de répétition.', tip: 'Récupère vraiment pendant le trot : l\'objectif est la qualité de chaque répétition, pas l\'épuisement.' },
};
export const RPE_SCALE: [number, string][] = [
  [2, 'Très facile : marche rapide'], [4, 'Facile : tu parles sans effort'], [6, 'Modéré : tu parles en phrases courtes'],
  [7, 'Soutenu : quelques mots'], [8, 'Dur : un mot'], [9, 'Très dur : impossible de parler'], [10, 'Maximal'],
];
/** Explications des termes qu'on trouve dans les séances. */
export const RUN_TERMS: [RegExp, string][] = [
  [/lignes? droites?/i, 'Lignes droites : 15 s d\'accélération fluide jusqu\'à une vitesse rapide mais relâchée, pas un sprint. Concentre-toi sur une foulée légère et rapide. Récupère en marchant 45 s. Elles améliorent ton économie de course sans fatiguer.'],
  [/accélérations?/i, 'Accélérations : 15 à 20 s en montant progressivement en vitesse, puis tu relâches. Elles réveillent les jambes avant l\'effort.'],
  [/trot/i, 'Récup en trot : tu continues à courir très lentement (ou tu marches si besoin) entre les répétitions. Ne t\'arrête pas complètement : ça garde le cœur actif.'],
  [/seuil/i, 'Allure seuil : l\'allure la plus rapide que tu peux tenir environ 40 à 60 min. En séance, on la fractionne pour pouvoir la tenir proprement.'],
  [/tempo/i, 'Tempo : allure soutenue continue, un peu en dessous du seuil. Effort 6–7 sur 10.'],
  [/chrono|test/i, 'Test : effort maximal mais régulier. Pars prudemment sur le premier kilomètre, accélère sur le dernier. Fais-le toujours sur le même parcours plat pour pouvoir comparer.'],
  [/très facile|récupération/i, 'Très facile : encore plus lent que ton footing habituel. Le but est uniquement de faire circuler le sang.'],
];

/* ---------- Récupération active ---------- */
export const MOBILITY: Move[] = [
  { name: 'Marche', dose: '30 min, rythme tranquille', how: ['Dehors si possible. La promenade avec Sirius compte.'], why: 'Relance la circulation et aide la récupération sans fatigue supplémentaire.' },
  { name: 'Chat-vache', dose: '10 lents', how: ['À quatre pattes, mains sous les épaules, genoux sous les hanches.', 'Inspire en creusant le dos et en levant la tête, expire en arrondissant le dos et en rentrant le menton.'], why: 'Mobilise toute la colonne.' },
  { name: 'Ouverture thoracique', dose: '8 par côté', how: ['À quatre pattes, une main derrière la tête.', 'Fais pivoter le coude vers le plafond en suivant du regard, puis vers le sol.'], why: 'Rotation du haut du dos, utile pour l\'épaule et la course.' },
  { name: 'Hanches 90/90', dose: '8 passages', how: ['Assise, les deux genoux pliés à 90°, un devant toi, un sur le côté.', 'Bascule les deux genoux de l\'autre côté sans t\'aider des mains si possible.'], why: 'Rotation des hanches, souvent raides après CrossFit et course.' },
  { name: 'Fente basse', dose: '45 s par côté', how: ['Genou au sol, pied avant devant, bassin qui avance doucement.', 'Serre la fesse du côté du genou posé.'], why: 'Fléchisseurs de hanche.' },
  { name: 'Chevilles au mur', dose: '10 par côté', how: ['Pied à 10 cm du mur, amène le genou toucher le mur sans décoller le talon.'], why: 'Mobilité de cheville pour squats et course.' },
  { name: 'Wall slides épaules', dose: '10 lents', how: ['Dos, tête et bras contre le mur, coudes à 90°.', 'Fais glisser les bras vers le haut sans décoller les poignets ni cambrer.'], why: 'Mobilité et contrôle de l\'épaule. Arrête-toi avant la douleur.' },
];

/* ---------- Renforcement : fiches détaillées ---------- */
export interface ExGuide { setup: string[]; exec: string[]; breath: string; feel: string; mistakes: string[]; easier: string; harder: string; search: string }
export const EX_GUIDE: Record<string, ExGuide> = {
  f1: { setup: ['Assise au sol, le haut du dos contre un banc stable (bord du banc sous les omoplates).', 'Barre au pli de la hanche, avec un coussin de protection.', 'Pieds à plat, largeur de hanches, à une distance telle que les tibias soient verticaux en position haute.'],
    exec: ['Rentre le menton et regarde devant toi, pas le plafond.', 'Pousse dans les talons pour monter les hanches jusqu\'à ce que le buste et les cuisses soient alignés.', 'Serre fort les fessiers 1 seconde en haut, côtes basses.', 'Redescends contrôlé jusqu\'à frôler le sol, et repars.'],
    breath: 'Inspire en bas, bloque légèrement pendant la montée, expire en haut.', feel: 'Fessiers en premier. Un peu les ischios, presque pas le bas du dos.',
    mistakes: ['Cambrer en haut : le bas du dos travaille à la place des fessiers.', 'Pieds trop loin : ce sont les ischios qui prennent.', 'Regarder le plafond : le dos s\'hyperétend.'], easier: 'Pont fessier au sol, sans charge puis avec haltère.', harder: 'Pause de 3 s en haut, ou version une jambe.', search: 'hip thrust barre technique' },
  m2: { setup: ['Règle le coussin pour bloquer les cuisses.', 'Poignée neutre (paumes face à face) ou prise un peu plus large que les épaules.'],
    exec: ['Avant de tirer, abaisse les épaules loin des oreilles.', 'Tire les coudes vers les hanches, poitrine vers la barre, buste légèrement incliné.', 'Remonte en 2 secondes jusqu\'à bras presque tendus.'],
    breath: 'Expire en tirant, inspire en remontant.', feel: 'Grands dorsaux (côtés du dos), sous les aisselles.', mistakes: ['Se balancer en arrière pour tirer.', 'Tirer avec les bras en gardant les épaules hautes.'], easier: 'Tirage élastique à genoux.', harder: 'Tractions assistées puis libres.', search: 'tirage vertical prise neutre technique' },
  m1: { setup: ['Une extrémité de barre calée dans un coin ou un support landmine.', 'Un genou au sol, du côté du bras qui pousse. Buste droit, gainé.'],
    exec: ['Barre à hauteur d\'épaule, coude devant et légèrement écarté (~45°).', 'Pousse vers le haut et légèrement en avant jusqu\'à bras tendu.', 'Laisse l\'omoplate accompagner le mouvement.', 'Redescends contrôlé.'],
    breath: 'Expire en poussant.', feel: 'Avant et milieu de l\'épaule, triceps.', mistakes: ['Cambrer le bas du dos : serre la fesse du côté du genou posé.', 'Coude collé au corps ou complètement ouvert.'], easier: 'Pompes inclinées sur un banc.', harder: 'Version debout, ou développé haltères assis.', search: 'landmine press demi genou technique' },
  m3: { setup: ['Banc incliné à environ 30°, poitrine en appui, pieds au sol.', 'Un haltère dans chaque main, bras tendus vers le sol.'],
    exec: ['Tire les coudes vers les poches arrière, près du corps.', 'Serre les omoplates 1 seconde en haut.', 'Redescends lentement.'], breath: 'Expire en tirant.', feel: 'Milieu du dos, entre les omoplates, et arrière des épaules.',
    mistakes: ['Hausser les épaules.', 'Décoller la poitrine du banc pour tricher.'], easier: 'Rowing élastique.', harder: 'Pause de 2 s en haut.', search: 'rowing buste appuyé haltères' },
  m4: { setup: ['Debout, légèrement penchée en avant, haltères légers sur les côtés.'],
    exec: ['Monte les bras sur les côtés et un peu vers l\'avant (~30°), coudes légèrement fléchis.', 'Arrête à hauteur d\'épaule.', 'Redescends en 2 à 3 secondes.'], breath: 'Expire en montant.', feel: 'Côté de l\'épaule (deltoïde moyen) : c\'est lui qui donne l\'épaule ronde.',
    mistakes: ['Prendre de l\'élan avec le corps : baisse la charge.', 'Monter plus haut que les épaules.', 'Hausser les trapèzes.'], easier: 'Version élastique ou un bras à la poulie.', harder: 'Dernière série en dégressive (même série avec une charge plus légère).', search: 'élévations latérales technique épaule' },
  m5: { setup: ['Poulie avec corde à hauteur des yeux.'], exec: ['Tire la corde vers ton front en écartant les mains.', 'Finis pouces vers l\'arrière, coudes hauts.', 'Pause 1 s, puis reviens.'], breath: 'Expire en tirant.', feel: 'Arrière des épaules et haut du dos.',
    mistakes: ['Tirer trop lourd et se pencher en arrière.'], easier: 'Pull-apart élastique.', harder: 'Pause de 3 s en position finale.', search: 'face pull technique' },
  m6: { setup: ['Curl : assise sur banc incliné à 45°, bras pendants.', 'Triceps : poulie haute avec corde.'], exec: ['Curl : plie les coudes sans les avancer, remonte puis redescends lentement.', 'Enchaîne direct avec les extensions triceps : coudes collés au corps, tends les bras vers le bas en écartant la corde.'], breath: 'Expire à l\'effort.', feel: 'Biceps puis triceps.',
    mistakes: ['Balancer le buste.', 'Décoller les coudes du corps au triceps.'], easier: 'Élastiques.', harder: 'Tempo lent en descente (3 s).', search: 'curl incliné haltères triceps poulie corde' },
  m7: { setup: ['Roue : à genoux sur un tapis, mains sur la roue sous les épaules.', 'Pallof : élastique ou poulie à hauteur de poitrine, sur le côté.'],
    exec: ['Roue : rentre le bassin (comme pour coller le bas du dos au plafond), roule vers l\'avant aussi loin que tu peux sans creuser, reviens.', 'Pallof : debout de profil, pousse les mains devant toi et tiens 2 s sans laisser le buste tourner.'],
    breath: 'Expire en revenant (roue) ou en poussant (Pallof).', feel: 'Abdos profonds, pas le bas du dos.', mistakes: ['Creuser le dos à la roue : réduis l\'amplitude.', 'Tourner le buste au Pallof.'], easier: 'Dead bug : sur le dos, bras et jambes en l\'air, descends bras et jambe opposés sans décoller le bas du dos.', harder: 'Roue plus loin, ou debout.', search: 'ab wheel rollout débutant' },
  f2: { setup: ['Dos à un banc, à environ une grande enjambée.', 'Pose le dessus du pied arrière sur le banc. Haltères dans les mains.'],
    exec: ['Descends en pliant le genou avant, buste légèrement penché en avant.', 'Le genou avant reste dans l\'axe du pied.', 'Remonte en poussant dans le talon avant.'], breath: 'Inspire en descendant, expire en montant.', feel: 'Fessier et quadriceps de la jambe avant.',
    mistakes: ['Pied avant trop proche : le genou dépasse beaucoup et la cheville souffre.', 'Pousser avec la jambe arrière.'], easier: 'Fente arrière sans banc.', harder: 'Tempo 3 s en descente.', search: 'fente bulgare technique fessiers' },
  f3: { setup: ['Barre ou haltères devant les cuisses, pieds largeur de hanches.'], exec: ['Genoux légèrement fléchis et fixes.', 'Pousse les hanches vers l\'arrière, la barre glisse le long des cuisses.', 'Descends jusqu\'à mi-tibia ou jusqu\'à ce que ton dos veuille s\'arrondir.', 'Remonte en poussant les hanches vers l\'avant.'],
    breath: 'Inspire et gaine avant de descendre, expire en haut.', feel: 'Arrière des cuisses et fessiers. Jamais de douleur dans le bas du dos.', mistakes: ['Arrondir le dos.', 'Plier les genoux comme un squat.', 'Éloigner la barre des jambes.'], easier: 'Haltères légers, amplitude réduite.', harder: 'Version une jambe.', search: 'soulevé de terre roumain technique' },
  f4: { setup: ['Talons sur une petite cale (2–3 cm). Haltère tenu contre la poitrine.'], exec: ['Descends entre tes talons, buste droit, genoux qui avancent au-dessus des orteils.', 'Va aussi bas que possible en gardant le dos droit.', 'Remonte sans rebond.'], breath: 'Inspire en bas, expire en remontant.', feel: 'Quadriceps (avant des cuisses).',
    mistakes: ['Talons qui décollent.', 'Rebondir en bas.'], easier: 'Squat sur une box.', harder: 'Pause de 2 s en bas.', search: 'goblet squat talons surélevés' },
  f5: { setup: ['Machine abduction, ou élastique au-dessus des genoux.'], exec: ['Buste légèrement penché en avant.', 'Écarte les genoux, pause 1 s, reviens lentement.'], breath: 'Expire en ouvrant.', feel: 'Haut et côté des fessiers.',
    mistakes: ['Revenir trop vite.'], easier: 'Élastique plus léger.', harder: 'Pause de 3 s en ouverture.', search: 'abduction hanche machine fessiers' },
};

/* ---------- Jours sans séance guidée ---------- */
export const BOX_GUIDE = ['Arrive 10 min avant pour t\'échauffer à ton rythme.', 'Adapte les charges à ton état du jour : en orange, garde 1 à 2 répétitions en réserve.', 'Si un mouvement réveille ton épaule, demande une variante au coach (pompes inclinées, landmine, anneaux à la place des barres).', 'Après le cours, note ton effort (1–10) : c\'est ce qui règle les jours suivants.'];
export const REST_GUIDE = ['Le repos fait partie du programme : c\'est là que tes muscles se reconstruisent.', 'Une marche ou une promenade avec Sirius est bienvenue, sans chercher l\'effort.', 'Dors, hydrate-toi, et mange suffisamment de protéines.', 'Rien à rattraper.'];
