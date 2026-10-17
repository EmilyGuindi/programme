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
const SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
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

function Mark({ status, onStage, icon }: { status: Status; onStage?: boolean; icon: IconName }) {
  const v = useRef(new Animated.Value(1)).current; const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    AccessibilityInfo.isReduceMotionEnabled().then(r => { if (r) return; v.setValue(0.5); Animated.spring(v, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }).start(); }).catch(() => {});
  }, [status]);
  const { c } = useTheme();
  return <Animated.View style={{ transform: [{ scale: v }] }}>{icon === 'check' ? <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: status === 'synced' ? c.accent : c.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={11} color={c.accentInk} /></View> : <DayBadge status={status} icon={icon} onStage={onStage} />}</Animated.View>;
}

/** Le tracker hebdomadaire BYYND : une colonne par jour.
 *  En haut, la coche lime = fait. Au centre, la date ; aujourd'hui en lime plein. En bas, le pictogramme de la séance prévue.
 *  Le jour sélectionné est cerclé de lime. */
export function WeekTracker({ s, start, today, selected, onSelect }: { s: AppState; start: string; today: string; selected?: string; onSelect?: (d: string) => void }) {
  const { c } = useTheme();
  const days = Array.from({ length: 7 }, (_, i) => adapted(s, addDays(start, i)));
  return (
    <Row gap={6} style={{ justifyContent: 'space-between' }}>
      {days.map(a => {
        const st = dayStatus(s, a, today); const isToday = a.date === today; const isSel = a.date === selected; const pre = st === 'none';
        const doneish = st === 'done' || st === 'synced' || st === 'raceDone';
        const iconCol = st === 'race' || st === 'raceDone' ? c.accent : doneish ? c.ink : st === 'optional' || st === 'rest' || st === 'missed' ? c.ink3 : c.ink2;
        return (
          <Pressable key={a.date} disabled={pre || !onSelect} accessibilityRole="button" accessibilityState={{ selected: isSel }}
            accessibilityLabel={`${DAY[dow(a.date)]} ${parseISO(a.date).getDate()}${isToday ? ", aujourd'hui" : ''} : ${(a.replaced || a).title}, ${STATUS_LABEL[st]}`}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onSelect?.(a.date); }}
            style={({ pressed }) => ({ flex: 1, alignItems: 'center', opacity: pre ? 0.35 : pressed ? 0.8 : 1 })}>
            <View style={{ height: 18, justifyContent: 'center', marginBottom: 4 }}>
              {doneish ? <Mark status={st} icon="check" /> : st === 'pending' ? <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: c.warn, alignItems: 'center', justifyContent: 'center' }}><T v="xs" color={c.paper} style={{ fontSize: 10, lineHeight: 12, fontWeight: '700' }}>?</T></View> : null}
            </View>
            <View style={{ alignSelf: 'stretch', alignItems: 'center', paddingVertical: 8, borderRadius: 18, backgroundColor: c.surface2, borderWidth: 1.5, borderColor: isSel ? c.accent : 'transparent' }}>
              <T v="xs" color={isToday ? c.ink : c.ink3} style={{ fontWeight: '600', fontSize: 11 }}>{SHORT[dow(a.date)]}</T>
              <View style={{ width: 34, height: 34, borderRadius: 12, marginTop: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? c.accent : c.surface }}>
                <T v="num" color={isToday ? c.accentInk : c.ink} style={{ fontSize: 16, lineHeight: 19 }}>{parseISO(a.date).getDate()}</T>
              </View>
              <View style={{ height: 22, justifyContent: 'center', marginTop: 6 }}>{!pre ? <Icon name={dayIcon(a)} size={17} color={iconCol} /> : null}</View>
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

/** Version ligne : pictogramme de la séance + coche lime si faite (même langage que le tracker). */
export function DayMini({ status, a }: { status: Status; a: AdaptedPlan }) {
  const { c } = useTheme(); const done = status === 'done' || status === 'synced' || status === 'raceDone';
  const col = status === 'race' || status === 'raceDone' ? c.accent : done ? c.ink : status === 'rest' || status === 'optional' || status === 'missed' ? c.ink3 : c.ink2;
  return (
    <Row gap={6}>
      <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}><Icon name={dayIcon(a)} size={18} color={col} /></View>
      <View style={{ width: 18 }}>{done ? <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={12} color={c.accentInk} /></View> : null}</View>
    </Row>
  );
}
