import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { achievementsMemo, CAT_LABEL, nextMilestone, toCelebrate, type Achievement } from '@/engine/achievements';
import { fmtShort, sportDay } from '@/engine/dates';
import { haptic, useReducedMotion } from '@/feedback';
import { update, useApp } from '@/store/store';
import { layout, radius, space, useTheme } from '@/theme/tokens';
import { AchBadge } from './badges';
import { Stage } from './brand';
import { Button, Meter, Row, T } from './ui';

/** Moment de déverrouillage : posé dans la page (pas de pop-up), une fois par accomplissement.
 *  Animation courte de l'insigne, retour haptique, puis le prochain jalon pertinent. Rien si la mise en scène est désactivée. */
export function UnlockMoment() {
  const s = useApp(); const { c } = useTheme(); const reduced = useReducedMotion(); const d = sportDay();
  const list = achievementsMemo(s, d); const a = toCelebrate(s, d, list)[0];
  const scale = useRef(new Animated.Value(reduced ? 1 : 0.4)).current; const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!a) return;
    haptic('success');
    if (reduced) { scale.setValue(1); return; }
    scale.setValue(0.4); glow.setValue(0);
    Animated.parallel([Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }), Animated.sequence([Animated.timing(glow, { toValue: 1, duration: 260, useNativeDriver: true }), Animated.timing(glow, { toValue: 0.35, duration: 500, useNativeDriver: true })])]).start();
  }, [a?.id]);
  if (!a) return null;
  const next = nextMilestone(s, d, a.cat, list);
  const seen = () => update(st => { st.celebrated = { ...(st.celebrated || {}), [a.id]: Date.now() }; });
  const major = a.tier === 'major'; const ink = major ? c.accentInk : c.stageInk; const ink2 = major ? c.accentInk : c.stageInk2;
  return (
    <Stage mark tone={major ? 'lime' : 'ink'} glow={!major}>
      <View accessibilityLiveRegion="polite" accessibilityLabel={`Accomplissement débloqué : ${a.title}`}>
        <Row gap={space.s3}>
          <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={{ position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: major ? 'rgba(11,13,10,0.12)' : c.accentSoft, opacity: glow, transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }] }} />
            <Animated.View style={{ transform: [{ scale }] }}><AchBadge cat={a.cat} status="unlocked" major={major} size={64} label={a.title} /></Animated.View>
          </View>
          <View style={{ flex: 1 }}>
            <T v="small" color={major ? c.accentInk : c.accent} style={{ fontWeight: '700' }}>Accomplissement débloqué</T>
            <T v="small" color={ink2}>{`${CAT_LABEL[a.cat]}, ${fmtShort(a.date!)}`}</T>
          </View>
        </Row>
        <T v="title" color={ink} style={{ marginTop: space.s3 }}>{a.title}</T>
        <T v="small" color={ink2} style={{ marginTop: 2 }}>{a.detail || a.description}</T>
        {next ? <T v="small" color={ink2} style={{ marginTop: space.s3 }}>{`Prochain jalon : ${next.title.toLowerCase()}. ${next.progress!.label}.`}</T> : null}
        <Row gap={space.s4} style={{ marginTop: space.s4 }}>
          <Button kind={major ? 'inverse' : 'primary'} label="Bien joué" style={{ flex: 1 }} onPress={seen} />
          <Button kind="ghost" label="Voir" onPress={() => { seen(); router.push({ pathname: '/progress/[view]', params: { view: 'records' } }); }} style={{ paddingHorizontal: space.s2 }} />
        </Row>
      </View>
    </Stage>
  );
}

/** Ligne de jalon : insigne, titre, progression réelle. */
export function MilestoneRow({ a, onPress, last }: { a: Achievement; onPress?: () => void; last?: boolean }) {
  const { c } = useTheme(); const got = a.status === 'unlocked';
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`${a.title}. ${got ? `Atteint le ${fmtShort(a.date!)}` : a.progress?.label || 'À venir'}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingVertical: space.s3, paddingHorizontal: layout.pad, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: c.line2, backgroundColor: pressed ? c.surface2 : 'transparent' })}>
      <AchBadge cat={a.cat} status={a.status} major={a.tier === 'major'} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <T v="label" color={got ? c.ink : c.ink2}>{a.title}</T>
        <T v="xs" muted numberOfLines={2}>{got ? (a.detail ? `${a.detail}, ${fmtShort(a.date!)}` : fmtShort(a.date!)) : a.progress?.label || a.criterion}</T>
        {!got && a.progress && a.progress.value > 0 ? <View style={{ marginTop: 4 }}><Meter value={a.progress.value / a.progress.target} /></View> : null}
      </View>
    </Pressable>
  );
}
export const _ar = radius;
