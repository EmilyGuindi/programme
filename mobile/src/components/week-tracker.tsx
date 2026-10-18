import type React from 'react';
import { haptic } from '@/feedback';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { adapted } from '@/engine/coach';
import { dayStatus } from '@/engine/status';
import { addDays, dow, parseISO } from '@/engine/dates';
import type { AdaptedPlan, AppState } from '@/engine/types';
import { space, useTheme } from '@/theme/tokens';
import { STATUS_LABEL, type Status, type WeekSummary } from '@/engine/status';
import { reducedMotion, useReducedMotion } from '@/feedback';
import { Icon, type IconName } from './icons';
import { Row, T } from './ui';

const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAY = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export { dayStatus } from '@/engine/status';

/** Pictogramme du type de séance prévu. */
export function dayIcon(a: AdaptedPlan): IconName {
  const t = (a.replaced || a).type;
  if (a.type === 'event') return 'flag';
  if (t === 'run') return 'shoe';
  if (t === 'box') return a.hyrox ? 'sled' : 'kettlebell';
  if (t === 'renfo') return 'dumbbell';
  if (t === 'recup') return 'walk';
  return 'moon';
}
/** Pastille de jour : le pictogramme dit QUOI, la forme dit OÙ J'EN SUIS.
 *  plein = fait (avec coche), contour = prévu, pointillés = optionnel, cobalt = course, sans cercle = repos. */
export function DayBadge({ status, icon, size = 32, onStage }: { status: Status; icon: IconName; size?: number; onStage?: boolean }) {
  const { c } = useTheme(); const ink = onStage ? c.stageInk : c.ink; const faint = onStage ? c.stageInk2 : c.ink3;
  const filled = status === 'done' || status === 'synced'; const race = status === 'race' || status === 'raceDone';
  if (status === 'rest' || status === 'none') return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}><Icon name="moon" size={size * 0.55} color={faint} /></View>;
  const border = race || filled ? 'transparent' : status === 'adapted' ? c.warn : status === 'missed' ? (onStage ? c.stageInk2 : c.line2) : status === 'optional' ? faint : (onStage ? c.stageInk2 : c.ink2);
  const bg = race ? c.accent : filled ? ink : 'transparent'; const fg = race ? c.accentInk : filled ? (onStage ? c.stage : c.paper) : status === 'missed' ? faint : ink;
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: race || filled ? 0 : 1.5, borderStyle: status === 'optional' ? 'dashed' : 'solid', borderColor: border, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={size * 0.6} color={fg} />
      </View>
      {filled || status === 'raceDone' ? <View style={{ position: 'absolute', right: -3, bottom: -3, width: 15, height: 15, borderRadius: 8, backgroundColor: c.ok, borderWidth: 2, borderColor: onStage ? c.stage : c.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={9} color={c.paper} /></View> : null}
      {status === 'synced' ? <View style={{ position: 'absolute', right: -2, top: -2, width: 9, height: 9, borderRadius: 5, backgroundColor: c.accent, borderWidth: 1.5, borderColor: onStage ? c.stage : c.surface }} /> : null}
      {status === 'pending' ? <View style={{ position: 'absolute', right: -3, bottom: -3, width: 15, height: 15, borderRadius: 8, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><T v="xs" color={c.accentInk} style={{ fontSize: 10, lineHeight: 12, fontWeight: '700' }}>?</T></View> : null}
      {status === 'adapted' ? <View style={{ position: 'absolute', right: -2, bottom: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: c.warn, borderWidth: 2, borderColor: onStage ? c.stage : c.surface }} /> : null}
    </View>
  );
}

function Mark({ status, children }: { status: Status; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(1)).current; const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reducedMotion()) return; v.setValue(0.9); Animated.spring(v, { toValue: 1, friction: 6, tension: 180, useNativeDriver: true }).start();
  }, [status]);
  return <Animated.View style={{ transform: [{ scale: v }] }}>{children}</Animated.View>;
}

/** Rendu d'un état : UN seul signal dominant, la surface de la case.
 *  fait = plein clair · compétition = plein lime (terminée : plein clair + drapeau lime) · prévu = contour ·
 *  non fait = contour pâle · optionnel et repos = sans contour, atténués · à confirmer = contour ambre. */
export function cellStyle(c: ReturnType<typeof useTheme>['c'], st: Status, isToday = false) {
  switch (st) {
    case 'done': case 'synced': return { bg: c.ink, fg: c.paper, glyph: c.paper, border: 'transparent', dash: false };
    case 'raceDone': return { bg: c.ink, fg: c.paper, glyph: c.paper, border: 'transparent', dash: false };
    case 'race': return { bg: c.accent, fg: c.accentInk, glyph: c.accentInk, border: 'transparent', dash: false };
    case 'pending': case 'raceToConfirm': return { bg: 'transparent', fg: c.ink, glyph: c.warn, border: c.warn, dash: false };
    case 'inProgress': return { bg: c.accentSoft, fg: c.ink, glyph: c.accent, border: c.accent, dash: false };
    case 'partial': return { bg: c.surface2, fg: c.ink, glyph: c.ink2, border: c.stroke, dash: false };
    case 'missed': return { bg: 'transparent', fg: c.ink3, glyph: c.ink3, border: c.line2, dash: false };
    case 'optional': return { bg: 'transparent', fg: c.ink2, glyph: c.ink3, border: c.stroke, dash: true };
    case 'rest': case 'none': return { bg: 'transparent', fg: c.ink3, glyph: c.ink3, border: 'transparent', dash: false };
    default: return { bg: 'transparent', fg: c.ink, glyph: c.ink2, border: isToday ? c.ink : c.stroke, dash: false };
  }
}

/** Tracker hebdomadaire : une case par jour. Aujourd'hui = libellé « Auj. » ; sélection = anneau lime autour de la case. */
export function WeekTracker({ s, start, today, selected, onSelect }: { s: AppState; start: string; today: string; selected?: string; onSelect?: (d: string) => void }) {
  const { c } = useTheme();
  const days = Array.from({ length: 7 }, (_, i) => adapted(s, addDays(start, i)));
  return (
    <Row gap={4} style={{ justifyContent: 'space-between' }}>
      {days.map(a => {
        const st = dayStatus(s, a, today); const isToday = a.date === today; const isSel = a.date === selected; const pre = st === 'none' && a.date < s.user.startDate;
        const k = cellStyle(c, st, isToday);
        return (
          <Pressable key={a.date} disabled={pre || !onSelect} accessibilityRole="button" accessibilityState={{ selected: isSel, disabled: pre }}
            accessibilityLabel={`${DAY[dow(a.date)]} ${parseISO(a.date).getDate()}${isToday ? ", aujourd'hui" : ''} : ${(a.replaced || a).title}, ${STATUS_LABEL[st] || 'avant le programme'}`}
            onPress={() => { haptic('select'); onSelect?.(a.date); }}
            style={({ pressed }) => ({ flex: 1, alignItems: 'center', opacity: pre ? 0.3 : pressed ? 0.75 : 1 })}>
            <T v="xs" color={isToday ? c.ink : c.ink3} style={{ fontFamily: isToday ? 'Inter_700Bold' : 'Inter_500Medium', fontSize: 11, lineHeight: 14, marginBottom: 6 }} maxFontSizeMultiplier={1.2}>{isToday ? 'Auj.' : LETTERS[dow(a.date)]}</T>
            <View style={{ padding: 2, borderRadius: 18, borderWidth: 2, borderColor: isSel ? c.accent : 'transparent', alignSelf: 'stretch' }}>
              <Mark status={st}>
                <View style={{ height: 58, borderRadius: 14, backgroundColor: k.bg, borderWidth: k.border === 'transparent' ? 0 : isToday && st === 'planned' ? 2 : 1.5, borderStyle: k.dash ? 'dashed' : 'solid', borderColor: k.border, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                  <T v="num" color={k.fg} style={{ fontSize: 17, lineHeight: 20 }} maxFontSizeMultiplier={1.2}>{parseISO(a.date).getDate()}</T>
                  {!pre ? <Icon name={st === 'raceDone' || st === 'raceToConfirm' ? 'flag' : dayIcon(a)} size={13} color={st === 'raceDone' ? c.accent : k.glyph} filled={st === 'raceDone'} /> : <View style={{ height: 13 }} />}
                </View>
              </Mark>
            </View>
          </Pressable>
        );
      })}
    </Row>
  );
}

/** Légende compacte, seulement les états présents. */
export function StatusLegend({ statuses }: { statuses: Status[] }) {
  const { c } = useTheme(); const has = (x: Status[]) => statuses.some(st => x.includes(st));
  return (
    <Row gap={14} style={{ flexWrap: 'wrap' }}>
      {has(['done', 'synced', 'raceDone']) ? <Row gap={5}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={8} color={c.accentInk} /></View><T v="xs" muted>fait</T></Row> : null}
      <Row gap={5}><Icon name="shoe" size={13} color={c.ink2} /><T v="xs" muted>pictogramme = séance prévue</T></Row>
      {has(['race', 'raceDone']) ? <Row gap={5}><Icon name="flag" size={13} color={c.accent} /><T v="xs" muted>course</T></Row> : null}
    </Row>
  );
}

/** Version ligne : la même case en miniature, avec le pictogramme de la séance. */
export function DayMini({ status, a }: { status: Status; a: AdaptedPlan }) {
  const { c } = useTheme(); const k = cellStyle(c, status);
  return (
    <View accessibilityLabel={STATUS_LABEL[status]} style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: k.bg, borderWidth: k.border === 'transparent' ? 0 : 1.5, borderStyle: k.dash ? 'dashed' : 'solid', borderColor: k.border, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={status === 'raceDone' || status === 'raceToConfirm' ? 'flag' : dayIcon(a)} size={18} color={status === 'raceDone' ? c.accent : k.glyph} filled={status === 'raceDone'} />
    </View>
  );
}

/** Jauge de la semaine : une case par séance prévue (jamais par jour : le repos n'est pas une case vide).
 *  lime = faite · lime à contour = faite en version adaptée · contour = à venir · pâle = non faite. Les optionnelles faites s'ajoutent en bonus. */
export function WeekMeter({ w }: { w: WeekSummary }) {
  const { c } = useTheme(); const reduced = useReducedMotion();
  const fill = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => { if (!reduced) Animated.timing(fill, { toValue: 1, duration: 360, useNativeDriver: true }).start(); }, [w.done]);
  if (!w.planned && !w.optionalDone && !w.races) return null;
  const cells: ('done' | 'adapted' | 'open' | 'missed' | 'bonus')[] = [
    ...Array(w.done - w.adapted).fill('done'), ...Array(w.adapted).fill('adapted'), ...Array(w.remaining).fill('open'), ...Array(w.missed).fill('missed'), ...Array(w.optionalDone).fill('bonus')];
  const complete = w.planned > 0 && w.done === w.planned;
  return (
    <View style={{ paddingHorizontal: space.s2, marginTop: space.s4 }} accessible accessibilityLabel={`Semaine : ${w.text}`}>
      {cells.length ? <View style={{ flexDirection: 'row', gap: 4 }}>
        {cells.map((k, i) => <Animated.View key={i} style={{ flex: 1, height: 6, borderRadius: 3, opacity: k === 'done' || k === 'adapted' || k === 'bonus' ? fill : 1,
          backgroundColor: k === 'done' ? c.accent : k === 'adapted' ? c.accentSoft : k === 'bonus' ? c.ink2 : k === 'missed' ? c.line : 'transparent',
          borderWidth: k === 'open' || k === 'adapted' ? 1 : 0, borderColor: k === 'adapted' ? c.accent : c.stroke }} />)}
      </View> : null}
      <Row between style={{ marginTop: 8 }}>
        <T v="xs" color={complete ? c.accent : c.ink2} style={{ fontWeight: '600', flex: 1 }}>{complete ? `Semaine bouclée · ${w.text}` : w.text}</T>
      </Row>
    </View>
  );
}
