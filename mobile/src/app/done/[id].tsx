import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { haptic, reducedMotion } from '@/feedback';
import { Icon } from '@/components/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark } from '@/components/logo';
import { Button, Card, Choices, Field, Row, T } from '@/components/ui';
import { buildClosure } from '@/engine/closure';
import { update, useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';

/** Fin de séance : faits, contribution, prochaine étape. Deux questions maximum, fermeture immédiate possible. */
export default function DoneScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const s = useApp(); const { c } = useTheme();
  const a = s.activities.find(x => x.id === id);
  const scale = useRef(new Animated.Value(0.6)).current; const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // Première ouverture seulement : retour haptique et animation. En revenant sur le bilan, l'écran s'affiche directement.
    const first = !!a && !s.closures?.[a.id];
    if (first) update(st => { st.closures = { ...(st.closures || {}), [a!.id]: Date.now() }; });
    if (first) haptic('success');
    if (!first || reducedMotion()) { scale.setValue(1); fade.setValue(1); return; }
    Animated.parallel([Animated.spring(scale, { toValue: 1, friction: 7, useNativeDriver: true }), Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true })]).start();
  }, []);
  if (!a) return null;
  const cl = buildClosure(s, a); const ci = s.checkins[a.date];
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }}>
      <Row style={{ justifyContent: 'flex-end', padding: space.s4 }}><Button small kind="ghost" label="Fermer" onPress={close} /></Row>
      <Animated.ScrollView style={{ opacity: fade }} contentContainerStyle={{ paddingHorizontal: space.s4, paddingBottom: 60, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <Animated.View style={{ alignSelf: 'center', transform: [{ scale }], backgroundColor: c.accent, borderRadius: 999, width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: space.s4 }}>
          <BrandMark size={46} color={c.accentInk} />
        </Animated.View>
        <T v="title" style={{ textAlign: 'center' }}>Séance terminée</T>
        <T muted style={{ textAlign: 'center', marginBottom: space.s4 }}>{cl.title}</T>
        {cl.stats.filter(x => !/kcal/.test(x)).length ? <Row gap={space.s2} style={{ justifyContent: 'center', flexWrap: 'wrap', marginBottom: cl.stats.some(x => /kcal/.test(x)) ? space.s2 : space.s4 }}>{cl.stats.filter(x => !/kcal/.test(x)).map(x => <View key={x} style={{ backgroundColor: c.surface2, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6 }}><T v="label">{x}</T></View>)}</Row> : null}
        {cl.stats.filter(x => /kcal/.test(x)).map(x => <T key={x} v="small" muted style={{ textAlign: 'center', marginBottom: space.s4 }}>{x}</T>)}
        {cl.records.length ? <View style={{ backgroundColor: c.accent, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s3 }}>
          <T v="eyebrow" color={c.accentInk}>{cl.records.length > 1 ? 'Nouveaux records' : 'Nouveau record'}</T>
          {cl.records.map(r => <T key={r} v="h3" color={c.accentInk} style={{ marginTop: 4 }}>{r}</T>)}
        </View> : null}
        <Card>
          {cl.facts.map(f => <T key={f} style={{ marginBottom: 6 }}>{f}</T>)}
          {cl.steps ? <Row gap={8} style={{ marginBottom: 6 }}><Icon name="check" size={16} color={c.accent} /><T v="small">{cl.steps}</T></Row> : null}
          {cl.adapted ? <T v="small" color={c.warn} style={{ marginBottom: 6 }}>{`Version adaptée : ${cl.adapted.charAt(0).toLowerCase()}${cl.adapted.slice(1)}`}</T> : null}
          {cl.goal ? <T v="small" muted>{`Objectif travaillé : ${cl.goal}`}</T> : null}
        </Card>
        {cl.contributions.length ? <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s3, gap: space.s2 }}>
          <T v="small" muted style={{ fontWeight: '600' }}>Cette séance compte pour</T>
          {cl.contributions.map(x => <Row key={x.title} between><T v="label" style={{ flex: 1 }} color={x.unlocked ? c.accent : c.ink}>{x.title}</T><T v="small" color={x.unlocked ? c.accent : c.ink2} style={{ fontWeight: '600' }}>{x.text}</T></Row>)}
        </View> : null}
        {cl.askEffort ? <Field label="Effort ressenti" hint="1 très facile · 10 maximal"><Choices cols={10} options={Array.from({ length: 10 }, (_, i) => [i + 1, String(i + 1)] as [number, string])} value={a.effort} onChange={v => update(st => { const x = st.activities.find(y => y.id === a.id); if (x) { x.effort = v; x.askEffort = false; } })} /></Field> : null}
        {cl.askPain ? <Field label="Une douleur ou une gêne ?"><Choices options={[['non', 'Non'], ['épaule', 'Épaule'], ['genou', 'Genou'], ['dos', 'Dos'], ['autre', 'Autre']]} value={ci?.pain === 'non' ? 'non' : ci?.painZone ?? null} onChange={v => update(st => { const k = a.date; const cur = st.checkins[k] || {}; st.checkins[k] = v === 'non' || !v ? { ...cur, pain: v ? 'non' : null } : { ...cur, pain: 'oui', painZone: v, painLevel: cur.painLevel ?? 3 }; })} /></Field> : null}
        {cl.next ? <Card tone="flat"><T v="small" muted>Prochaine étape</T><T v="label">{cl.next}</T></Card> : null}
        <Button kind="primary" block label="Continuer" onPress={close} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}
