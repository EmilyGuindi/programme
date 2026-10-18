import type React from 'react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { pendingClosure } from '@/engine/closure';
import { addDays, clock as clockS, daysBetween, fmtShort } from '@/engine/dates';
import { nextEvent, pendingDebrief, readiness, resultValue } from '@/engine/race';
import { availableRecaps } from '@/engine/recap';
import { useApp } from '@/store/store';
import { layout, radius, space, useTheme } from '@/theme/tokens';
import { BrandMark } from './logo';
import { Chevron, Meta, Row, T, Tag } from './ui';

/** Cartes contextuelles d'Aujourd'hui : prochaine compétition, débrief, fin de séance Strava, bilan du dimanche. Au plus deux à la fois. */
export function ContextCards({ d }: { d: string }) {
  const s = useApp(); const { c } = useTheme(); const cards: React.ReactElement[] = [];
  const deb = pendingDebrief(s, d);
  if (deb && deb.date !== d) cards.push(<Ctx key="deb" tag={deb.type === 'crossfit-compet' ? 'Compétition terminée' : 'Course terminée'} title={deb.name} value={deb.result ? resultValue(deb, clockS) : undefined} sub={deb.result ? 'Deux questions, puis ton analyse.' : 'Saisis ton résultat pour ton analyse.'} onPress={() => router.push({ pathname: '/race/[id]', params: { id: deb.id } })} />);
  const ev = nextEvent(s, d, 21);
  if (ev && ev.date !== d) {
    const n = daysBetween(d, ev.date); const rd = readiness(s, ev, d);
    cards.push(
      <Pressable key="race" onPress={() => router.push({ pathname: '/race/[id]', params: { id: ev.id } })} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', backgroundColor: pressed ? c.surface2 : c.surface, borderRadius: radius.r2, marginBottom: layout.gap, overflow: 'hidden' })}>
        <View style={{ width: 88, alignSelf: 'stretch', backgroundColor: c.stage, alignItems: 'center', justifyContent: 'center', paddingVertical: layout.pad }}>
          <T v="display" color={c.stageInk} style={{ fontSize: 34, lineHeight: 36 }}>{`J-${n}`}</T>
          <T v="overline" color={c.stageInk2}>{fmtShort(ev.date)}</T>
        </View>
        <View style={{ width: 4, alignSelf: 'stretch', backgroundColor: c.accent }} />
        <View style={{ flex: 1, padding: layout.pad }}>
          <T v="small" color={c.accent} style={{ fontWeight: '600' }}>Prochaine course</T>
          <T v="label" style={{ marginTop: 2 }}>{ev.name}</T>
          <Meta items={[ev.distanceKm ? `${String(ev.distanceKm).replace('.', ',')} km` : null, `Préparation ${rd.label.toLowerCase()}`]} style={{ marginTop: 2 }} />
        </View>
        <View style={{ paddingRight: layout.pad }}><Chevron /></View>
      </Pressable>);
  }
  const pc = pendingClosure(s, addDays(d, -1), d);
  if (pc && pc.source === 'strava') cards.push(<Ctx key="cl" tag="Strava" title={`${pc.title} enregistré`} sub="Voir le bilan de ta séance" onPress={() => router.push({ pathname: '/done/[id]', params: { id: pc.id } })} />);
  const rec = availableRecaps(s)[0];
  if (rec && !s.recapsSeen?.[String(rec)]) cards.push(<Ctx key="recap" tag="Bilan" title={`Ta semaine ${rec} en un coup d'œil`} sub="Quelques cartes, 30 secondes" onPress={() => router.push({ pathname: '/recap/[week]', params: { week: String(rec) } })} />);
  return <>{cards.slice(0, 2)}</>;
}
function Ctx({ tag, title, sub, value, onPress }: { tag: string; title: string; sub: string; value?: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${tag} : ${title}. ${sub}`} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.s3, backgroundColor: pressed ? c.surface2 : c.surface, borderRadius: radius.r2, padding: layout.pad, marginBottom: layout.gap })}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}><BrandMark size={20} /></View>
      <View style={{ flex: 1 }}>
        <T v="small" color={c.accent} style={{ fontWeight: '600' }}>{tag}</T>
        <Row between style={{ marginTop: 2 }}><T v="label" style={{ flex: 1 }}>{title}</T>{value ? <T v="label" style={{ fontVariant: ['tabular-nums'] }}>{value}</T> : null}</Row>
        <T v="small" muted>{sub}</T>
      </View>
      <Chevron />
    </Pressable>
  );
}
