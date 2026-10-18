import { haptic, reducedMotion } from '@/feedback';
import { router, useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Animated, Modal, Pressable, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassSurface } from '@/components/glass';
import { Icon } from '@/components/icons';
import { Button, Row, T } from '@/components/ui';
import { adapted, ZONE_NAME, zoneText } from '@/engine/coach';
import { segments, totalSec } from '@/engine/segments';
import { setCheck } from '@/engine/session';
import { update, useApp } from '@/store/store';
import { font, radius, space, useTheme } from '@/theme/tokens';

const mmss = (sec: number) => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; };

/** Mode course : lisible en courant, utilisable d'une main. Chronos réels ; distance et allure viennent de la montre. */
export default function RunLive() {
  useKeepAwake();
  const { date } = useLocalSearchParams<{ date: string }>(); const s = useApp(); const { c } = useTheme();
  const a = adapted(s, date); const run = a.run!;
  const [easyRest, setEasyRest] = useState(false);
  const segs = useMemo(() => { const sg = segments(run); return easyRest ? sg.map(x => (x.kind === 'work' ? { ...x, zone: 'easy' as const, label: x.label.replace('Répétition', 'Footing facile') } : x)) : sg; }, [run, easyRest]);
  const [phase, setPhase] = useState<'count' | 'run' | 'pause'>('count'); const [count, setCount] = useState(3);
  const [idx, setIdx] = useState(0); const [, tick] = useState(0); const [planB, setPlanB] = useState(false);
  const acc = useRef({ total: 0, seg: 0, since: 0 });
  const scale = useRef(new Animated.Value(1)).current;
  const now = () => Date.now();
  const elapsed = () => acc.current.total + (phase === 'run' ? (now() - acc.current.since) / 1000 : 0);
  const segElapsed = () => acc.current.seg + (phase === 'run' ? (now() - acc.current.since) / 1000 : 0);

  useEffect(() => {
    if (phase !== 'count') return;
    if (count === 0) { acc.current.since = now(); setPhase('run'); haptic('success'); return; }
    if (!reducedMotion()) { scale.setValue(1.3); Animated.timing(scale, { toValue: 1, duration: 600, useNativeDriver: true }).start(); }
    haptic('untick');
    const t = setTimeout(() => setCount(count - 1), 900); return () => clearTimeout(t);
  }, [phase, count]);
  useEffect(() => { if (phase !== 'run') return; const t = setInterval(() => tick(x => x + 1), 250); return () => clearInterval(t); }, [phase]);
  const seg = segs[Math.min(idx, segs.length - 1)]; const left = seg.sec != null ? seg.sec - segElapsed() : null;
  useEffect(() => { if (phase === 'run' && left != null && left <= 0) next(true); });

  function bank() { const n = now(); const d = (n - acc.current.since) / 1000; acc.current.total += d; acc.current.seg += d; acc.current.since = n; }
  function next(auto = false) {
    if (phase === 'run') bank();
    if (idx >= segs.length - 1) { finish(); return; }
    acc.current.seg = 0; acc.current.since = now(); setIdx(idx + 1);
    Vibration.vibrate(auto ? [0, 250, 120, 250] : 60); haptic('warning');
  }
  function toggle() { if (phase === 'run') { bank(); setPhase('pause'); } else { acc.current.since = now(); setPhase('run'); } haptic('select'); }
  function finish() {
    if (phase === 'run') bank();
    const min = Math.round(acc.current.total / 60);
    update(st => { st.runs[date] = { ...(st.runs[date] || {}), min: String(min) }; run.steps.forEach((_, i) => { if (i <= seg.step) setCheck(st, date, `step:${run.kind}:${i + 1}`, true); }); });
    router.replace({ pathname: '/run/[date]', params: { date, finished: '1' } });
  }
  function confirmEnd() { Alert.alert('Terminer la séance ?', `${mmss(elapsed())} enregistrées. Ta montre transmettra la distance et l'allure via Strava.`, [{ text: 'Continuer', style: 'cancel' }, { text: 'Terminer', style: 'destructive', onPress: finish }]); }
  function applyPlanB(kind: 'easy' | 'cool') {
    setPlanB(false);
    if (kind === 'easy') { setEasyRest(true); update(st => { st.overrides[date] = { ...(st.overrides[date] || {}), adj: { kind: 'easy', reason: 'Plan B pendant la séance : fin en footing facile.', proposalId: `planb-${date}` } }; }); }
    else { const last = segs.length - 1; if (phase === 'run') bank(); acc.current.seg = 0; acc.current.since = now(); setIdx(last); update(st => { st.overrides[date] = { ...(st.overrides[date] || {}), adj: { kind: 'easy', reason: 'Plan B pendant la séance : séance raccourcie.', proposalId: `planb-${date}` } }; }); }
    haptic('success');
  }

  if (phase === 'count') return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.paper, alignItems: 'center', justifyContent: 'center' }}>
      <T v="overline" muted>{run.title}</T>
      <Animated.Text style={{ fontFamily: font.displayHeavy, fontSize: 160, lineHeight: 170, color: c.accent, transform: [{ scale }] }}>{count}</Animated.Text>
      <Button kind="ghost" label="Passer" onPress={() => setCount(0)} />
    </SafeAreaView>
  );

  const zone = seg.zone; const nextSeg = segs[idx + 1]; const pct = totalSec(segs) ? Math.min(1, elapsed() / totalSec(segs)) : 0;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }}>
      <Row between style={{ paddingHorizontal: space.s4, paddingTop: space.s3 }}>
        <View style={{ flex: 1 }}><T v="overline" muted>{`Segment ${idx + 1} / ${segs.length}`}</T><T v="small" muted numberOfLines={1}>{run.title}</T></View>
        <Pressable accessibilityRole="button" onPress={() => setPlanB(true)} hitSlop={8}><GlassSurface r={18}><Row gap={6} style={{ paddingHorizontal: 14, height: 40 }}><Icon name="swap" size={18} color={c.ink} /><T v="label">Plan B</T></Row></GlassSurface></Pressable>
      </Row>
      <View style={{ height: 4, marginHorizontal: space.s4, marginTop: space.s3, borderRadius: 2, backgroundColor: c.line2 }}><View style={{ width: `${pct * 100}%`, height: 4, borderRadius: 2, backgroundColor: c.accent }} /></View>

      <View style={{ flex: 1, paddingHorizontal: space.s5, justifyContent: 'center' }} accessibilityLiveRegion="polite">
        <T v="h2" style={{ fontSize: 26, lineHeight: 32 }}>{seg.label}</T>
        {zone ? <View style={{ marginTop: space.s5 }}><T v="overline" muted>Allure cible</T>
          <T style={{ fontFamily: font.displayHeavy, fontSize: 64, lineHeight: 70, color: c.accent, letterSpacing: -2, fontVariant: ['tabular-nums'] }}>{zoneText(s, zone).replace(' /km', '')}</T>
          <T muted>{`/km · ${ZONE_NAME[zone].split(' ·')[0].toLowerCase()}`}</T></View> : null}
        <View style={{ marginTop: space.s5 }}>
          <T v="overline" muted>{left != null ? 'Reste sur ce segment' : 'Segment libre'}</T>
          <T style={{ fontFamily: font.displayHeavy, fontSize: 88, lineHeight: 94, color: c.ink, letterSpacing: -3, fontVariant: ['tabular-nums'] }}>{left != null ? mmss(left) : mmss(segElapsed())}</T>
        </View>
        <Row gap={space.s5} style={{ marginTop: space.s3 }}>
          <View><T v="overline" muted>Temps total</T><T v="num">{mmss(elapsed())}</T></View>
          {nextSeg ? <View style={{ flex: 1 }}><T v="overline" muted>Ensuite</T><T v="small" numberOfLines={2}>{nextSeg.label}</T></View> : null}
        </Row>
        <T v="xs" muted style={{ marginTop: space.s4 }}>Distance et allure réelle : ta montre les enregistre, elles arrivent par Strava après la séance.</T>
      </View>

      <View style={{ paddingHorizontal: space.s4, paddingBottom: space.s4 }}>
        <GlassSurface r={34}>
          <Row style={{ padding: 10, justifyContent: 'space-between' }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Terminer la séance" onPress={confirmEnd} style={({ pressed }) => ({ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.stopSoft : c.surface2 })}><Icon name="stop" size={22} color={c.stop} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={phase === 'run' ? 'Pause' : 'Reprendre'} onPress={toggle} style={({ pressed }) => ({ flex: 1, marginHorizontal: 10, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 })}><Icon name={phase === 'run' ? 'pause' : 'play'} size={24} color={c.accentInk} /><T v="h3" color={c.accentInk}>{phase === 'run' ? 'Pause' : 'Reprendre'}</T></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Segment suivant" onPress={() => next(false)} style={({ pressed }) => ({ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.line2 : c.surface2 })}><Icon name="next" size={22} color={c.ink} /></Pressable>
          </Row>
        </GlassSurface>
      </View>

      <Modal visible={planB} transparent animationType="fade" onRequestClose={() => setPlanB(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setPlanB(false)}>
          <View style={{ backgroundColor: c.surface, borderTopLeftRadius: radius.r3, borderTopRightRadius: radius.r3, padding: space.s5, gap: space.s3 }}>
            <T v="h2">Plan B</T>
            <T muted>Trop dur, douleur, conditions difficiles : on adapte sans culpabiliser. Le changement est enregistré dans ton programme.</T>
            <Button kind="primary" block label="Finir en footing facile" onPress={() => applyPlanB('easy')} />
            <Button block label="Passer au retour au calme" onPress={() => applyPlanB('cool')} />
            <Button kind="ghost" block label="Continuer comme prévu" onPress={() => setPlanB(false)} />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
