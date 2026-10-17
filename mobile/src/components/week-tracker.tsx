import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Pressable, View } from 'react-native';
import { adapted, doneOn } from '@/engine/coach';
import { addDays, dow, parseISO } from '@/engine/dates';
import type { AdaptedPlan, AppState } from '@/engine/types';
import { space, useTheme } from '@/theme/tokens';
import { STATUS_LABEL, type Status } from './brand';
import { Icon, type IconName } from './icons';
import { Row, T } from './ui';

const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DAY = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** Statut d'un jour, identique partout (Aujourd'hui, Programme, Progression). */
export function dayStatus(s: AppState, a: AdaptedPlan, today: string): Status {
  if (a.date < s.user.startDate) return 'none';
  if (a.type === 'event') return a.event?.result || s.activities.some(x => x.eventId === a.event?.id) ? 'raceDone' : 'race';
  const acts = s.activities.filter(x => x.date === a.date && !x.complementary);
  if (doneOn(s, a.date)) return acts.some(x => x.source === 'strava') ? 'synced' : 'done';
  if (acts.some(x => x.needsConfirm)) return 'pending';
  if (a.type === 'rest') return 'rest';
  if (a.date < today && a.mandatory && !a.skipped) return 'missed';
  if (a.optional) return 'optional';
  if (a.reason || a.replaced) return 'adapted';
  return 'planned';
}

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
  const bg = race ? c.accent : filled ? ink : 'transparent'; const fg = race ? '#fff' : filled ? (onStage ? c.stage : c.paper) : status === 'missed' ? faint : ink;
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: race || filled ? 0 : 1.5, borderStyle: status === 'optional' ? 'dashed' : 'solid', borderColor: border, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={size * 0.6} color={fg} />
      </View>
      {filled || status === 'raceDone' ? <View style={{ position: 'absolute', right: -3, bottom: -3, width: 15, height: 15, borderRadius: 8, backgroundColor: c.ok, borderWidth: 2, borderColor: onStage ? c.stage : c.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={9} color="#fff" /></View> : null}
      {status === 'synced' ? <View style={{ position: 'absolute', right: -2, top: -2, width: 9, height: 9, borderRadius: 5, backgroundColor: c.accent, borderWidth: 1.5, borderColor: onStage ? c.stage : c.surface }} /> : null}
      {status === 'pending' ? <View style={{ position: 'absolute', right: -3, bottom: -3, width: 15, height: 15, borderRadius: 8, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><T v="xs" color="#fff" style={{ fontSize: 10, lineHeight: 12, fontWeight: '700' }}>?</T></View> : null}
      {status === 'adapted' ? <View style={{ position: 'absolute', right: -2, bottom: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: c.warn, borderWidth: 2, borderColor: onStage ? c.stage : c.surface }} /> : null}
    </View>
  );
}

function Mark({ status, onStage, icon }: { status: Status; onStage?: boolean; icon: IconName }) {
  const v = useRef(new Animated.Value(1)).current; const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    AccessibilityInfo.isReduceMotionEnabled().then(r => { if (r) return; v.setValue(0.5); Animated.spring(v, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }).start(); }).catch(() => {});
  }, [status]);
  return <Animated.View style={{ transform: [{ scale: v }] }}><DayBadge status={status} icon={icon} onStage={onStage} /></Animated.View>;
}

/** Le tracker hebdomadaire BYYND. Aujourd'hui = chiffre cobalt souligné ; sélection = colonne charcoal. */
export function WeekTracker({ s, start, today, selected, onSelect }: { s: AppState; start: string; today: string; selected?: string; onSelect?: (d: string) => void }) {
  const { c } = useTheme();
  const days = Array.from({ length: 7 }, (_, i) => adapted(s, addDays(start, i)));
  return (
    <Row gap={0} style={{ justifyContent: 'space-between' }}>
      {days.map(a => {
        const st = dayStatus(s, a, today); const isToday = a.date === today; const isSel = a.date === selected; const pre = st === 'none';
        const fg = isSel ? c.stageInk : pre ? c.ink3 : c.ink;
        return (
          <Pressable key={a.date} disabled={pre || !onSelect} accessibilityRole="button" accessibilityState={{ selected: isSel }}
            accessibilityLabel={`${DAY[dow(a.date)]} ${parseISO(a.date).getDate()}${isToday ? ", aujourd'hui" : ''} : ${(a.replaced || a).title}, ${STATUS_LABEL[st]}`}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onSelect?.(a.date); }}
            style={({ pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: space.s2, marginHorizontal: 2, borderRadius: 14, backgroundColor: isSel ? c.stage : pressed ? c.surface2 : 'transparent', opacity: pre ? 0.4 : 1 })}>
            <T v="xs" color={isSel ? c.stageInk2 : isToday ? c.accent : c.ink3} style={{ fontWeight: '600' }}>{LETTERS[dow(a.date)]}</T>
            <T v="num" color={isToday && !isSel ? c.accent : fg} style={{ fontSize: 19, lineHeight: 22, marginTop: 2 }}>{parseISO(a.date).getDate()}</T>
            <View style={{ height: 3, width: 14, borderRadius: 2, marginTop: 3, backgroundColor: isToday ? (isSel ? c.stageInk : c.accent) : 'transparent' }} />
            <View style={{ height: 36, justifyContent: 'center', marginTop: 4 }}>{st !== 'none' ? <Mark status={st} icon={dayIcon(a)} onStage={isSel} /> : null}</View>
          </Pressable>
        );
      })}
    </Row>
  );
}

/** Légende compacte, seulement les états présents. */
export function StatusLegend({ statuses }: { statuses: Status[] }) {
  const uniq = [...new Set(statuses.filter(x => x !== 'none'))];
  const { c } = useTheme();
  const dot = (st: Status) => { const filled = st === 'done' || st === 'synced'; return <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: st === 'race' || st === 'raceDone' ? c.accent : filled ? c.ink : 'transparent', borderWidth: st === 'race' || st === 'raceDone' || filled ? 0 : 1.5, borderStyle: st === 'optional' ? 'dashed' : 'solid', borderColor: st === 'adapted' ? c.warn : st === 'missed' ? c.line2 : c.ink2 }} />; };
  return <Row gap={12} style={{ flexWrap: 'wrap' }}>{uniq.filter(x => x !== 'rest').map(st => <Row key={st} gap={5}>{dot(st)}<T v="xs" muted>{STATUS_LABEL[st]}</T></Row>)}</Row>;
}
