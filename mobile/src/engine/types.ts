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
}

export interface SportEvent {
  id: string; name: string; type: 'course' | 'ocr' | 'hyrox-compet' | 'autre'; date: ISODate; time?: string;
  distanceKm?: number | null; place?: string; priority: 'participation' | 'repère' | 'objectif'; goal?: string;
  status: 'prévu' | 'fait' | 'annulé';
  result?: { time: number; elevM?: number | null; avgHr?: number | null; effort?: number | null; notes?: string };
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

export interface ExerciseLog { kg: (string | null)[]; reps: (string | null)[]; done: boolean[] }
export interface StrengthLog { ex: Record<string, ExerciseLog>; warm?: Record<string, boolean>; leg?: string; level?: string }
export interface RunLog { km?: string; min?: string; elev?: string; hr?: string; rpe?: number | null; test?: string; steps?: Record<string, boolean> }

export interface Override { noHyrox?: boolean; level?: Level; skip?: boolean }

export interface AppState {
  v: number; updatedAt: number;
  user: {
    name: string; tz: string; height: number; startDate: ISODate;
    goals: { weightTarget: number; run: string; physique: string };
    prefs: { checkinTime: string; weighDay: number; weighTime: string; notifCheckin: boolean; notifWeigh: boolean; cycleOptIn: boolean };
    ref: { k10: number | null; k5: number | null };
  };
  program: { id: string; name: string; start: ISODate; weeks: number };
  events: SportEvent[]; activities: Activity[]; checkins: Record<ISODate, CheckIn>; measurements: Measurement[];
  strength: Record<ISODate, StrengthLog>; runs: Record<ISODate, RunLog>; overrides: Record<ISODate, Override>;
  migrated: boolean;
}

export type PlanType = 'box' | 'run' | 'renfo' | 'rest' | 'recup' | 'event';
export interface Plan {
  date: ISODate; type: PlanType; title: string; dur?: string; goal?: string; note?: string;
  run?: RunSession; event?: SportEvent; hyrox?: boolean; alt?: boolean; short?: boolean;
  optional: boolean; mandatory: boolean; skipped?: boolean; week: number;
}
export interface AdaptedPlan extends Plan { level: Level; reason: string | null; replaced?: { type: 'recup'; title: string; goal: string } }
