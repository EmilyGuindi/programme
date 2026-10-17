import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Pressable, View } from 'react-native';
import { adapted, doneOn } from '@/engine/coach';
import { addDays, dow, parseISO } from '@/engine/dates';
import type { AdaptedPlan, AppState } from '@/engine/types';
import { space, useTheme } from '@/theme/tokens';
import { StatusMark, STATUS_LABEL, type Status } from './brand';
import { Row, T } from './ui';

const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DAY = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** Statut d'un jour, identique partout (Aujourd'hui, Programme, Progression). */
export function dayStatus(s: AppState, a: AdaptedPlan, today: string): Status {
  if (a.date < s.user.startDate) return 'none';
  if (a.type === 'event') return 'race';
  const acts = s.activities.filter(x => x.date === a.date && !x.complementary);
  if (doneOn(s, a.date)) return acts.some(x => x.source === 'strava') ? 'synced' : 'done';
  if (acts.some(x => x.needsConfirm)) return 'pending';
  if (a.type === 'rest') return 'rest';
  if (a.date < today && a.mandatory && !a.skipped) return 'missed';
  if (a.optional) return 'optional';
  if (a.reason || a.replaced) return 'adapted';
  return 'planned';
}

function Mark({ status, onStage }: { status: Status; onStage?: boolean }) {
  const v = useRef(new Animated.Value(1)).current; const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    AccessibilityInfo.isReduceMotionEnabled().then(r => { if (r) return; v.setValue(0.5); Animated.spring(v, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }).start(); }).catch(() => {});
  }, [status]);
  return <Animated.View style={{ transform: [{ scale: v }] }}><StatusMark status={status} onStage={onStage} /></Animated.View>;
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
            <View style={{ height: 24, justifyContent: 'center', marginTop: 4 }}>{st !== 'none' ? <Mark status={st} onStage={isSel} /> : null}</View>
          </Pressable>
        );
      })}
    </Row>
  );
}

/** Légende compacte, seulement les états présents. */
export function StatusLegend({ statuses }: { statuses: Status[] }) {
  const uniq = [...new Set(statuses.filter(x => x !== 'none'))];
  return <Row gap={12} style={{ flexWrap: 'wrap' }}>{uniq.map(st => <Row key={st} gap={4}><StatusMark status={st} size={12} /><T v="xs" muted>{STATUS_LABEL[st]}</T></Row>)}</Row>;
}
