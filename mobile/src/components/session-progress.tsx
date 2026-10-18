import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useReducedMotion } from '@/feedback';
import { sessionProgress, SESSION_LABEL, type SessionProgress } from '@/engine/session';
import { sportDay } from '@/engine/dates';
import { useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';
import { Row, T } from './ui';

export const useSession = (date: string): SessionProgress => { const s = useApp(); return sessionProgress(s, date, sportDay()); };

/** Progression réelle d'une séance : éléments cochés / total, étape actuelle, étape suivante. Discrète, posée au-dessus de l'action principale. */
export function SessionProgressLine({ p, compact }: { p: SessionProgress; compact?: boolean }) {
  const { c } = useTheme(); const reduced = useReducedMotion();
  const w = useRef(new Animated.Value(p.ratio)).current;
  useEffect(() => { if (reduced) w.setValue(p.ratio); else Animated.timing(w, { toValue: p.ratio, duration: 220, useNativeDriver: false }).start(); }, [p.ratio, reduced]);
  if (!p.total) return null;
  const finished = p.state === 'terminee' || p.state === 'terminee-adaptee';
  const head = finished ? SESSION_LABEL[p.state] : p.allChecked ? 'Tout est coché' : p.done ? `${p.units.done} sur ${p.units.total} ${p.units.label}` : 'Pas encore commencée';
  const sets = `${p.done}/${p.total}`;
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`${head}. ${sets}${p.current ? `. En cours : ${p.current.label}` : ''}`} accessibilityValue={{ min: 0, max: p.total, now: p.done }} style={{ paddingHorizontal: compact ? 4 : 0, paddingBottom: compact ? space.s2 : 0 }}>
      <Row between><T v="small" style={{ fontWeight: '600' }} color={finished || p.allChecked ? c.accent : c.ink}>{head}</T><T v="xs" muted style={{ fontVariant: ['tabular-nums'] }}>{sets}</T></Row>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: c.line2, marginTop: space.s2, overflow: 'hidden' }}>
        <Animated.View style={{ height: 6, borderRadius: 3, backgroundColor: c.accent, width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
      </View>
      {!compact && !finished && p.current ? <View style={{ marginTop: space.s2, gap: 2 }}>
        <Row gap={8}><T v="xs" color={c.accent} style={{ width: 76, fontWeight: '600' }}>Maintenant</T><T v="xs" muted numberOfLines={2} style={{ flex: 1 }}>{p.current.label}</T></Row>
        {p.next ? <Row gap={8}><T v="xs" muted style={{ width: 76, fontWeight: '600' }}>Ensuite</T><T v="xs" muted numberOfLines={2} style={{ flex: 1 }}>{p.next.label}</T></Row> : null}
      </View> : null}
    </View>
  );
}

/** Pied de séance : progression + action principale, dans la surface flottante du Sheet. */
export function SessionFooter({ date, children }: { date: string; children: React.ReactNode }) {
  const p = useSession(date); const { c } = useTheme();
  return <View style={{ gap: 6 }}>{p.total ? <View style={{ backgroundColor: c.surface2, borderRadius: radius.r2, padding: space.s3 }}><SessionProgressLine p={p} /></View> : null}{children}</View>;
}
