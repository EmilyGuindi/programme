import type React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/theme/tokens';

/** Icônes linéaires 22 px, trait 1,8 : un seul jeu pour les accès secondaires et les réglages. */
export type IconName = 'calendar' | 'run' | 'body' | 'dumbbell' | 'path' | 'peak' | 'story' | 'target' | 'bell' | 'link' | 'cycle' | 'data' | 'spark' | 'shoe' | 'kettlebell' | 'sled' | 'walk' | 'moon' | 'flag' | 'flame' | 'check' | 'today' | 'chevrons' | 'person' | 'coach' | 'play' | 'pause' | 'stop' | 'swap' | 'plus' | 'next' | 'clock' | 'home' | 'plan' | 'stats' | 'profile';
type N = IconName;
export function Icon({ name, size = 22, color, filled, cut }: { name: N; size?: number; color?: string; filled?: boolean; /** Couleur des découpes intérieures d'une icône pleine (= fond sous l'icône). */ cut?: string }) {
  const { c } = useTheme(); const s = color || c.ink; const p = { stroke: s, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }; const f = filled ? s : 'none';
  /* Navigation : une famille à part, trait 1,75, mêmes proportions optiques (≈ 16,5 × 16,5 dans la grille de 24), coins arrondis.
     Contour = onglet inactif ; plein, avec découpes dans la couleur du fond = onglet actif. */
  const n = { stroke: s, strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: f }; const k = cut || c.nav;
  const shapes: Record<N, React.ReactElement> = {
    calendar: <><Rect x={3.5} y={5} width={17} height={15} rx={3} {...p} /><Path d="M3.5 10h17M8 3v4M16 3v4" {...p} /><Path d="M8.5 14.5l2 2 4-4" {...p} /></>,
    run: <><Circle cx={4.5} cy={19} r={1.6} fill={s} /><Path d="M7 18c4 0 3.5-6 8-6s3-6 4.5-8" {...p} strokeDasharray="0.1 3.4" /><Path d="M19.5 10V3.5h-0M19.5 4h4" {...p} /></>,
    body: <><Rect x={3} y={6} width={11} height={11} rx={3.5} {...p} /><Circle cx={8.5} cy={11.5} r={2.2} {...p} /><Path d="M14 14.5h7v3.5h-7" {...p} /></>,
    dumbbell: <><Path d="M7 12h10" {...p} /><Rect x={4} y={8} width={3} height={8} rx={1} {...p} /><Rect x={17} y={8} width={3} height={8} rx={1} {...p} /><Path d="M2 10.5v3M22 10.5v3" {...p} /></>,
    path: <><Circle cx={5} cy={19} r={2} {...p} /><Circle cx={13} cy={12} r={2} {...p} /><Circle cx={8} cy={5} r={2} {...p} /><Path d="M6.5 17.5l5-4M12 10.3L9.2 6.6" {...p} strokeDasharray="0.1 2.6" /></>,
    peak: <><Path d="M2.5 20l7-12 4 6 2.5-3 5.5 9z" {...p} /><Path d="M9.5 8V3l4 1.5-4 1.5" {...p} /></>,
    story: <><Rect x={5} y={3} width={14} height={18} rx={3} {...p} /><Path d="M8 7h8M8 7h3" {...p} /><Path d="M8.5 15l2.5-3 2 2 2.5-3.5" {...p} /></>,
    target: <><Circle cx={11} cy={13} r={8} {...p} /><Circle cx={11} cy={13} r={3.5} {...p} /><Path d="M11 13l9-9M16.5 4h3.5v3.5" {...p} /></>,
    bell: <><Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" {...p} /><Path d="M10 21h4" {...p} /></>,
    link: <><Rect x={2.5} y={8} width={8} height={8} rx={2.5} {...p} /><Rect x={13.5} y={8} width={8} height={8} rx={2.5} {...p} /><Path d="M10.5 12h3" {...p} /></>,
    cycle: <><Path d="M3 19h4v-4h4v-4h4V7h6" {...p} /><Circle cx={21} cy={7} r={1.6} fill={s} /></>,
    data: <><Rect x={4} y={3.5} width={16} height={5} rx={1.8} {...p} /><Rect x={4} y={9.5} width={16} height={5} rx={1.8} {...p} /><Rect x={4} y={15.5} width={16} height={5} rx={1.8} {...p} /></>,
    shoe: <><Path d="M3 15.2c0-2.3 1-4 2.6-4.6L9 9.3l1.6 2 2-.6 1.5 2.1c2 .4 5.3.8 6.3 2.2.7 1 .5 2.5-1 2.5H4.6C3.6 17.5 3 16.6 3 15.2z" {...p} /><Path d="M3.4 15.3h17.3M8.3 10.3l.9 1.3M10.9 10.8l.9 1.2" {...p} /></>,
    kettlebell: <><Path d="M9 9.5V8a3 3 0 0 1 6 0v1.5" {...p} /><Circle cx={12} cy={14.5} r={5.5} {...p} /><Path d="M9.5 19.5h5" {...p} /></>,
    sled: <><Rect x={5} y={8.5} width={9.5} height={6} rx={1.2} {...p} /><Path d="M3.5 17h14.5a2.5 2.5 0 0 0 2.5-2.5M14.5 11.5h4v-4" {...p} /></>,
    walk: <><Path d="M8 3.5c1.5 0 2.2 1.7 2.2 3.8S9.4 11 8 11s-2.2-1.6-2.2-3.7S6.5 3.5 8 3.5zM7 13h2.2" {...p} /><Path d="M16 9.5c1.5 0 2.2 1.7 2.2 3.8S17.4 17 16 17s-2.2-1.6-2.2-3.7.7-3.8 2.2-3.8zM15 19h2.2" {...p} /></>,
    moon: <Path d="M19 14.6A7.6 7.6 0 0 1 9.4 5a7.6 7.6 0 1 0 9.6 9.6z" {...p} />,
    flag: <><Path d="M6 21V3.5" {...p} /><Path d="M6 4.2h11.5l-2.6 3.7 2.6 3.7H6" {...p} /></>,
    flame: <Path d="M12 3c.4 3 4.8 4.9 4.8 9.8A4.8 4.8 0 0 1 12 17.6a4.8 4.8 0 0 1-4.8-4.8c0-2.1 1-3.4 2.1-4.2.2 1.6 1 2.6 2.1 2.7-.3-3.1.4-5.8.6-8.3z" {...p} />,
    check: <Path d="M5 12.5l4.3 4.3L19 7.2" {...p} />,
    today: <><Circle cx={12} cy={12} r={8.5} {...p} fill={filled ? s : 'none'} /><Circle cx={12} cy={12} r={2.6} fill={filled ? c.paper : s} /></>,
    chevrons: <><Path d="M4 13l8-6 8 6v-3.5l-8-6-8 6z" {...p} fill={f} /><Path d="M4 20l8-6 8 6v-3.5l-8-6-8 6z" {...p} fill={f} /></>,
    person: <><Circle cx={12} cy={7.5} r={3.8} {...p} fill={f} /><Path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6z" {...p} fill={f} /></>,
    coach: <><Path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17h0A1.5 1.5 0 0 1 4 15.5z" {...p} /><Path d="M8.5 9.5h7M8.5 12.5h4.5" {...p} /></>,
    play: <Path d="M7.5 5.2v13.6c0 .8.9 1.3 1.6.8l10-6.8a1 1 0 0 0 0-1.6l-10-6.8c-.7-.5-1.6 0-1.6.8z" fill={s} />,
    pause: <><Rect x={6} y={5} width={4} height={14} rx={1.4} fill={s} /><Rect x={14} y={5} width={4} height={14} rx={1.4} fill={s} /></>,
    stop: <Rect x={6} y={6} width={12} height={12} rx={2.5} fill={s} />,
    next: <><Path d="M5.5 5.8v12.4c0 .8.9 1.2 1.5.7l8-6.2a.9.9 0 0 0 0-1.4l-8-6.2c-.6-.5-1.5-.1-1.5.7z" fill={s} /><Rect x={16.5} y={5} width={2.5} height={14} rx={1.2} fill={s} /></>,
    clock: <><Circle cx={12} cy={12} r={8.5} {...p} /><Path d="M12 7.5V12l3 2" {...p} /></>,
    plus: <Path d="M12 5v14M5 12h14" {...p} />,
    swap: <><Path d="M7 7h11l-3-3M17 17H6l3 3" {...p} /></>,
    home: <Path d="M4.5 10.2 12 4.25l7.5 5.95v8.3a2 2 0 0 1-2 2h-3v-5.25a.75.75 0 0 0-.75-.75h-3.5a.75.75 0 0 0-.75.75v5.25h-3a2 2 0 0 1-2-2z" {...n} />,
    plan: <><Rect x={3.75} y={5} width={16.5} height={15.25} rx={3} {...n} /><Path d={filled ? 'M5.5 9.75h13' : 'M3.75 9.75h16.5'} {...n} stroke={filled ? k : s} /><Path d="M8.25 3.25v3.5M15.75 3.25v3.5" {...n} fill="none" /><Rect x={13.25} y={13.25} width={3.5} height={3.5} rx={0.9} fill={filled ? k : s} /></>,
    stats: <><Rect x={3.5} y={13.25} width={4.5} height={7} rx={1.4} {...n} /><Rect x={9.75} y={8.75} width={4.5} height={11.5} rx={1.4} {...n} /><Rect x={16} y={4.25} width={4.5} height={16} rx={1.4} {...n} /></>,
    profile: <><Circle cx={12} cy={8} r={3.75} {...n} /><Path d={filled ? 'M4.75 20.25c.7-3.85 3.55-5.85 7.25-5.85s6.55 2 7.25 5.85z' : 'M4.75 20.25c.7-3.85 3.55-5.85 7.25-5.85s6.55 2 7.25 5.85'} {...n} /></>,
    spark: <><Path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z" {...p} /><Path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" {...p} /></>,
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24">{shapes[name]}</Svg>;
}
