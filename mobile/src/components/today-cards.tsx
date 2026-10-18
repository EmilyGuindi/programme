import type React from 'react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { pendingClosure } from '@/engine/closure';
import { addDays, clock as clockS, daysBetween, fmtShort } from '@/engine/dates';
import { nextEvent, pendingDebrief, readiness } from '@/engine/race';
import { availableRecaps } from '@/engine/recap';
import { useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';
import { BrandMark } from './logo';
import { Chevron, Row, T, Tag } from './ui';

/** Cartes contextuelles d'Aujourd'hui : prochaine compétition, débrief, fin de séance Strava, bilan du dimanche. Au plus deux à la fois. */
export function ContextCards({ d }: { d: string }) {
  const s = useApp(); const { c } = useTheme(); const cards: React.ReactElement[] = [];
  const deb = pendingDebrief(s, d);
  if (deb && deb.date !== d) cards.push(<Ctx key="deb" tag="Course terminée" title={`${deb.name}${deb.result ? ` · ${clockS(deb.result.time)}` : ''}`} sub={deb.result ? 'Deux questions, puis ton analyse.' : 'Saisis ton résultat pour ton analyse.'} onPress={() => router.push({ pathname: '/race/[id]', params: { id: deb.id } })} />);
  const ev = nextEvent(s, d, 21);
  if (ev && ev.date !== d) {
    const n = daysBetween(d, ev.date); const rd = readiness(s, ev, d);
    cards.push(
      <Pressable key="race" onPress={() => router.push({ pathname: '/race/[id]', params: { id: ev.id } })} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.r2, marginBottom: space.s3, overflow: 'hidden', opacity: pressed ? 0.88 : 1 })}>
        <View style={{ width: 92, alignSelf: 'stretch', backgroundColor: c.stage, alignItems: 'center', justifyContent: 'center', paddingVertical: space.s4 }}>
          <T v="display" color={c.stageInk} style={{ fontSize: 34, lineHeight: 36 }}>{`J-${n}`}</T>
          <T v="overline" color={c.stageInk2}>{fmtShort(ev.date)}</T>
        </View>
        <View style={{ width: 4, alignSelf: 'stretch', backgroundColor: c.accent }} />
        <View style={{ flex: 1, padding: space.s4 }}>
          <T v="overline" color={c.accent}>Prochaine course</T>
          <T v="label" style={{ marginTop: 2 }}>{ev.name}</T>
          <T v="small" muted>{`Préparation : ${rd.label.toLowerCase()}${ev.distanceKm ? ` · ${String(ev.distanceKm).replace('.', ',')} km` : ''}`}</T>
        </View>
        <View style={{ paddingRight: space.s4 }}><Chevron /></View>
      </Pressable>);
  }
  const pc = pendingClosure(s, addDays(d, -1), d);
  if (pc && pc.source === 'strava') cards.push(<Ctx key="cl" tag="Strava" title={`${pc.title} enregistré`} sub="Voir le bilan de ta séance" onPress={() => router.push({ pathname: '/done/[id]', params: { id: pc.id } })} />);
  const rec = availableRecaps(s)[0];
  if (rec && !s.recapsSeen?.[String(rec)]) cards.push(<Ctx key="recap" tag="Bilan" title={`Ta semaine ${rec} en un coup d'œil`} sub="Quelques cartes, 30 secondes" onPress={() => router.push({ pathname: '/recap/[week]', params: { week: String(rec) } })} />);
  return <>{cards.slice(0, 2)}</>;
}
function Ctx({ tag, title, sub, onPress }: { tag: string; title: string; sub: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.s3, backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s3, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}><BrandMark size={20} /></View>
      <View style={{ flex: 1 }}><T v="overline" color={c.accent}>{tag}</T><T v="label" style={{ marginTop: 2 }}>{title}</T><T v="small" muted>{sub}</T></View>
      <Chevron />
    </Pressable>
  );
}
