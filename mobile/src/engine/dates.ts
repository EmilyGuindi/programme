import type { ISODate } from './types';

export const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export const iso = (d: Date): ISODate => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
export const parseISO = (s: ISODate): Date => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s: ISODate, n: number): ISODate => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
export const dow = (s: ISODate): number => (parseISO(s).getDay() + 6) % 7; // 0 = lundi
export const today = (): ISODate => iso(new Date());
export const daysBetween = (a: ISODate, b: ISODate) => Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 864e5);

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_L = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS_L = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const fmtShort = (s: ISODate) => { const d = parseISO(s); return `${d.getDate()} ${MONTHS[d.getMonth()].replace('.', '')}`; };
export const fmtLong = (s: ISODate) => { const d = parseISO(s); const w = DAYS_L[dow(s)]; return `${w[0].toUpperCase()}${w.slice(1)} ${d.getDate()} ${MONTHS_L[d.getMonth()]}`; };
export const fmtDay = (s: ISODate) => { const d = parseISO(s); return `${DAYS_L[dow(s)]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };

export const mmss = (sec: number) => { sec = Math.round(sec); return `${Math.floor(sec / 60)}'${String(sec % 60).padStart(2, '0')}`; };
export const clock = (sec: number) => { sec = Math.round(sec); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return `${h ? h + 'h' + String(m).padStart(2, '0') : m}:${String(s).padStart(2, '0')}`; };
export const parseTime = (t?: string | null): number | null => {
  if (!t) return null;
  const p = String(t).trim().replace(/[h'’]/g, ':').replace(/[^0-9:.]/g, '').split(':').filter(x => x !== '').map(Number);
  if (!p.length || p.some(isNaN)) return null;
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 60;
};
export const num = (v: unknown): number | null => { if (v == null || v === '') return null; const n = +String(v).replace(',', '.'); return isNaN(n) ? null : n; };
export const uid = () => Math.random().toString(36).slice(2, 10);
