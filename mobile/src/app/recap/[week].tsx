import { haptic, reducedMotion } from '@/feedback';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, FlatList, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IlluBody, IlluRegularity, IlluRun, IlluStrength } from '@/components/illustrations';
import { Wordmark } from '@/components/logo';
import { AchBadge } from '@/components/badges';
import { Button, Row, T } from '@/components/ui';
import { fmtShort } from '@/engine/dates';
import { buildRecap, type RecapCard } from '@/engine/recap';
import { update, useApp } from '@/store/store';
import { layout, radius, space, useTheme } from '@/theme/tokens';

const ILLU: Record<RecapCard['kind'], any> = { numbers: IlluRegularity, sessions: IlluRegularity, highlight: IlluRun, progress: IlluRun, records: IlluStrength, milestones: IlluStrength, worked: IlluRegularity, recovery: IlluBody, next: IlluRun };

export default function RecapScreen() {
  const { week } = useLocalSearchParams<{ week: string }>(); const s = useApp(); const { c } = useTheme(); const { width } = useWindowDimensions();
  const r = buildRecap(s, +week); const [i, setI] = useState(0); const list = useRef<FlatList<RecapCard>>(null); const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { update(st => { st.recapsSeen = { ...(st.recapsSeen || {}), [week]: Date.now() }; }); }, []);
  useEffect(() => { if (reducedMotion()) { fade.setValue(1); return; } fade.setValue(0); Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }).start(); }, [i]);
  const go = (n: number) => { if (n < 0) return; if (n >= r.cards.length) { router.back(); return; } haptic('select'); list.current?.scrollToIndex({ index: n }); setI(n); };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }}>
      <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: layout.gutter, paddingTop: space.s3 }}>
        {r.cards.map((_, k) => <View key={k} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: k <= i ? c.accent : c.line2 }} />)}
      </View>
      <Row between style={{ paddingHorizontal: layout.gutter, paddingVertical: space.s3 }}>
        <Wordmark height={12} onDark />
        <Button small kind="ghost" label="Fermer" onPress={() => router.back()} />
      </Row>
      <FlatList<RecapCard> ref={list} data={r.cards} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(_, k) => String(k)}
        onMomentumScrollEnd={e => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index }) => { return (
          <Animated.View style={{ width, paddingHorizontal: layout.gutter, justifyContent: 'center', flex: 1, opacity: index === i ? fade : 1 }}>
            
            {index === 0 ? <T v="small" color={c.ink2} style={{ marginBottom: 6 }}>{`${fmtShort(r.from)} – ${fmtShort(r.to)}`}</T> : null}
            <T v="title" color={c.ink}>{item.title}</T>
            {item.badges ? <Row gap={space.s3} style={{ marginTop: space.s4, flexWrap: 'wrap' }}>{item.badges.map(b => <AchBadge key={b.title} cat={b.cat} status="unlocked" major={b.major} size={72} label={b.title} />)}</Row> : null}
            {item.big ? <><T v="mega" color={c.accent} style={{ marginTop: space.s4, fontSize: 88, lineHeight: 92 }}>{item.big}</T><T color={c.ink2}>{item.bigLabel}</T></> : null}
            <View style={{ marginTop: space.s4, gap: 10 }}>{item.lines.map(l => <T key={l} color={c.ink}>{l}</T>)}</View>
          </Animated.View>); }} />
      <Row style={{ paddingHorizontal: layout.gutter, paddingVertical: space.s4 }}>
        <Button label="Précédent" kind="inverse" disabled={i === 0} onPress={() => go(i - 1)} />
        <Button kind="primary" style={{ flex: 1 }} label={i < r.cards.length - 1 ? 'Suivant' : 'Terminer'} onPress={() => go(i + 1)} />
      </Row>
    </SafeAreaView>
  );
}
