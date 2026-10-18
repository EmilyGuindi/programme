export type ISODate = string; // YYYY-MM-DD

export type ActivityType = 'crossfit' | 'hyrox' | 'hyrox-simu' | 'hyrox-compet' | 'running' | 'course' | 'renfo' | 'marche' | 'autre';
export type RunKind = 'facile' | 'recup' | 'affutage' | 'rappel' | 'qualite' | 'test';
export type Zone = 'easy' | 'seuil' | '10k' | '5k';
export type Level = 'vert' | 'orange' | 'rouge' | 'inconnu';

export interface RunStep { text: string; zone: Zone | null }
export interface RunSession { kind: RunKind; title: string; dur: string; goal: string; steps: RunStep[] }

export interface Activity {
  id: string; date: ISODate; type: ActivityType; title: string;
  durationMin?: number | null; distanceKm?: number | null; elevM?: number | null; avgHr?: number | null;
  effort?: number | null; notes?: string; complementary: boolean; matched?: ISODate | null;
  source: 'manuel' | 'strava' | 'migration' | 'healthconnect'; kind?: 'facile' | 'qualite' | 'test'; eventId?: string;
  /** Strava : identifiant, données brutes utiles, et décision de correspondance. */
  stravaId?: string; sportType?: string; startLocal?: string; elapsedMin?: number | null; maxHr?: number | null;
  laps?: { km: number; s: number; hr: number | null; elev: number | null }[];
  needsConfirm?: boolean; userEdited?: boolean; askEffort?: boolean;
  /** Énergie estimée par la montre ou Strava (kcal). Une seule source de vérité : l'activité elle-même. */
  calories?: number | null; caloriesStatus?: 'available' | 'absent' | 'pending'; caloriesAt?: number; description?: string;
}
export interface StravaItem {
  stravaId: string; name: string; sportType: string; date: ISODate; startLocal?: string; distanceKm: number | null; movingMin: number | null;
  elapsedMin: number | null; elevM: number | null; avgHr: number | null; maxHr: number | null; perceived?: number | null; trainer?: boolean;
  laps?: { km: number; s: number; hr: number | null; elev: number | null }[]; deleted?: boolean; updatedAt: number;
  calories?: number | null; caloriesChecked?: boolean; caloriesAt?: number; description?: string;
}

export interface SportEvent {
  id: string; name: string; type: 'course' | 'ocr' | 'hyrox-compet' | 'autre'; date: ISODate; time?: string;
  distanceKm?: number | null; place?: string; priority: 'participation' | 'repère' | 'objectif'; goal?: string;
  status: 'prévu' | 'fait' | 'annulé';
  result?: { time: number; elevM?: number | null; avgHr?: number | null; effort?: number | null; notes?: string;
    feeling?: number | null; pacing?: 'trop-vite' | 'regulier' | 'fini-fort' | null; conditions?: string[];
    /** D'où vient le temps : saisi, description Strava, ou chrono de la montre. */
    source?: 'saisi' | 'description' | 'montre'; movingSec?: number; distanceKm?: number | null; maxHr?: number | null; calories?: number | null };
  checklist?: Record<string, boolean>;
}

export interface CheckIn {
  sleep?: 'mal' | 'moyen' | 'bien' | 'tres' | null; energy?: number | null; soreness?: 'non' | 'peu' | 'fortes' | null;
  soreZone?: string | null; pain?: 'non' | 'oui' | null; painZone?: string | null; painLevel?: number | null;
  motivation?: number | null; period?: 'non' | 'oui' | null; at?: number;
}

export interface Measurement {
  id: string; date: ISODate; weight: number; fatPct?: number | null; fatKg?: number | null; muscleKg?: number | null;
  waist?: number | null; hips?: number | null; arm?: number | null; note?: string; photo?: string;
}

/** Coche d'un élément de séance (exercice, série, étape). `at` départage deux appareils : la plus récente gagne.
 *  Décocher écrit { on: false } avec une date : la coche ne peut pas « revenir » lors d'une synchro. */
export interface Mark { on: boolean; at: number }
/** `done` : ancien stockage des séries cochées, conservé pour la migration. La source de vérité est `AppState.checks`. */
export interface ExerciseLog { kg: (string | null)[]; reps: (string | null)[]; done: boolean[] }
export interface StrengthLog { ex: Record<string, ExerciseLog>; warm?: Record<string, boolean>; leg?: string; level?: string }
export interface RunLog { km?: string; min?: string; elev?: string; hr?: string; rpe?: number | null; test?: string; steps?: Record<string, boolean> }

export interface Adjustment { kind: 'easy' | 'reduced' | 'rest' | 'shoulder'; reason: string; proposalId: string }
export interface Override { noHyrox?: boolean; level?: Level; skip?: boolean; /** Garder la séance prévue malgré le check-in. */ keep?: boolean; adj?: Adjustment }

export interface AppState {
  v: number; updatedAt: number;
  user: {
    name: string; tz: string; height: number; startDate: ISODate;
    goals: { weightTarget: number; run: string; physique: string };
    prefs: { checkinTime: string; weighDay: number; weighTime: string; notifCheckin: boolean; notifWeigh: boolean; cycleOptIn: boolean; notifRecap?: boolean;
      /** Retours haptiques (défaut : activés). */ haptics?: boolean; /** Animations : celles du système, ou réduites dans BYYND. */ motion?: 'system' | 'reduced'; /** Mettre en scène les accomplissements débloqués (défaut : oui). */ celebrate?: boolean };
    ref: { k10: number | null; k5: number | null };
  };
  /** Programme en cours (ou le dernier, ou le prochain si aucun n'est en cours). Les autres sont dans `programs`. */
  program: ProgramDef;
  /** Programmes passés, à venir, brouillons et archivés. L'historique n'est jamais effacé. */
  programs?: ProgramDef[];
  events: SportEvent[]; activities: Activity[]; checkins: Record<ISODate, CheckIn>; measurements: Measurement[];
  strength: Record<ISODate, StrengthLog>; runs: Record<ISODate, RunLog>; overrides: Record<ISODate, Override>;
  migrated: boolean;
  strava?: { since: number; fillAt?: number };
  /** Écrans de fin de séance déjà montrés (une seule fois par activité). */
  closures?: Record<string, number>;
  /** Bilans hebdomadaires déjà ouverts. */
  recapsSeen?: Record<string, number>;
  /** Décisions sur les propositions du coach : acceptée ou programme gardé. */
  proposals?: Record<string, { decision: 'accepted' | 'kept'; at: number }>;
  /** Coches des séances, par jour puis par identifiant stable d'élément (`set:f1:2`, `warm:rameur`, `mob:chat-vache`, `step:facile:1`…). */
  checks?: Record<ISODate, Record<string, Mark>>;
  /** Activités supprimées dans l'app (id → date) : une synchro ne les fait pas réapparaître. */
  deleted?: Record<string, number>;
  /** Séances déplacées. moves : date d'origine → nouvelle date (to = origine : déplacement annulé, gardé pour la synchro).
   *  habits : changement du jour habituel d'un type de séance à partir d'une date. */
  reschedule?: Reschedule;
  /** Accomplissements déjà mis en scène (id → date) : l'animation de déverrouillage n'est jouée qu'une fois. */
  celebrated?: Record<string, number>;
}

export interface Reschedule {
  moves: Record<ISODate, { to: ISODate; at: number }>;
  habits: { type: 'run' | 'renfo'; fromDow: number; toDow: number; since: ISODate }[]; habitsAt: number;
}

export type PlanType = 'box' | 'run' | 'renfo' | 'rest' | 'recup' | 'event';
export interface Plan {
  date: ISODate; type: PlanType; title: string; dur?: string; goal?: string; note?: string;
  run?: RunSession; event?: SportEvent; hyrox?: boolean; alt?: boolean; short?: boolean;
  optional: boolean; mandatory: boolean; skipped?: boolean; week: number;
  /** Séance déplacée : date d'origine (identifiant de la séance) ou nouvelle date pour le jour quitté. */ movedFrom?: ISODate; movedTo?: ISODate;
}
export interface AdaptedPlan extends Plan { level: Level; reason: string | null; replaced?: { type: 'recup'; title: string; goal: string; dur?: string } }

/* ---------- Programmes successifs ---------- */
export type ProgramStatus = 'draft' | 'planned' | 'active' | 'done' | 'archived';
/** Contenu d'un jour type. */
export type Slot = 'crossfit' | 'hyrox' | 'run' | 'long' | 'renfo' | 'recup' | 'rest';
export type RunFocus = '10k' | '5k' | 'endurance' | 'maintien';
export interface ProgramPhase { n: string; name: string; from: number; to: number; goal: string; milestone: string; kind?: 'base' | 'dev' | 'spec' | 'taper' | 'bilan' }
/** Description d'un programme personnalisé : c'est tout ce que l'assistant ou l'utilisatrice fournit. Le calendrier en est déduit par BYYND. */
export interface ProgramSpec {
  /** Jour de la semaine (0 = lundi) → contenu type. */
  days: Slot[];
  focus: RunFocus;
  /** Semaine allégée toutes les n semaines (0 : aucune). */
  deloadEvery: number;
  /** Compétition objectif (identifiant d'événement), pour l'affûtage. */
  goalEventId?: string | null;
  /** Contraintes libres, affichées et gardées en mémoire (jamais interprétées comme des ordres). */
  constraints?: string;
  /** Tests chronométrés prévus. */
  tests?: boolean;
}
export interface ProgramSummary { planned: number; done: number; rate: number; km: number; runs: number; records: number; weightDelta: number | null; pace: { first: number | null; last: number | null }; at: number }
export interface ProgramDef {
  id: string; name: string; start: ISODate; weeks: number;
  status?: ProgramStatus;
  /** cycle1 : le calendrier d'origine (octobre à février). custom : généré depuis `spec`. */
  template?: 'cycle1' | 'custom';
  spec?: ProgramSpec;
  phases?: ProgramPhase[];
  /** Fin anticipée (un nouveau programme a démarré avant la fin prévue). */
  end?: ISODate;
  goal?: string;
  summary?: ProgramSummary;
  basedOn?: string;
  createdAt?: number; updatedAt?: number; activatedAt?: number;
}
