import type React from 'react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { pendingClosure } from '@/engine/closure';
import { addDays, daysBetween, fmtShort } from '@/engine/dates';
import { nextEvent, pendingDebrief, readiness } from '@/engine/race';
import { availableRecaps } from '@/engine/recap';
import { useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';
import { Symbol } from './logo';
import { Row, T, Tag } from './ui';

/** Cartes contextuelles d'Aujourd'hui : prochaine compétition, débrief, fin de séance Strava, bilan du dimanche. Au plus deux à la fois. */
export function ContextCards({ d }: { d: string }) {
  const s = useApp(); const { c } = useTheme(); const cards: React.ReactElement[] = [];
  const deb = pendingDebrief(s, d);
  if (deb) cards.push(<Ctx key="deb" tag="Débrief" title={`${deb.name} : comment ça s'est passé ?`} sub={deb.result ? 'Deux questions, puis ton analyse.' : 'Saisis ton résultat pour ton analyse.'} onPress={() => router.push({ pathname: '/race/[id]', params: { id: deb.id } })} />);
  const ev = nextEvent(s, d, 21);
  if (ev && ev.date !== d) {
    const n = daysBetween(d, ev.date); const rd = readiness(s, ev, d);
    cards.push(
      <Pressable key="race" onPress={() => router.push({ pathname: '/race/[id]', params: { id: ev.id } })} style={({ pressed }) => ({ backgroundColor: c.ink, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s3, opacity: pressed ? 0.9 : 1 })}>
        <Row between><Tag tone="inverse">Prochaine course</Tag><T v="small" color="rgba(244,242,238,.7)">{fmtShort(ev.date)}</T></Row>
        <Row style={{ marginTop: space.s3, alignItems: 'flex-end' }}>
          <T v="hero" color={c.paper}>{`J-${n}`}</T>
          <View style={{ flex: 1, paddingBottom: 4 }}><T v="label" color={c.paper}>{ev.name}</T><T v="small" color="rgba(244,242,238,.7)">{`Préparation : ${rd.label.toLowerCase()}${ev.distanceKm ? ` · ${String(ev.distanceKm).replace('.', ',')} km` : ''}`}</T></View>
        </Row>
        <T v="small" color={c.paper} style={{ marginTop: space.s2, textDecorationLine: 'underline' }}>Préparer ma course</T>
      </Pressable>);
  }
  const pc = pendingClosure(s, addDays(d, -1));
  if (pc && pc.source === 'strava') cards.push(<Ctx key="cl" tag="Strava" title={`${pc.title} enregistré`} sub="Voir le bilan de ta séance" onPress={() => router.push({ pathname: '/done/[id]', params: { id: pc.id } })} />);
  const rec = availableRecaps(s)[0];
  if (rec && !s.recapsSeen?.[String(rec)]) cards.push(<Ctx key="recap" tag="Bilan" title={`Ta semaine ${rec} en un coup d'œil`} sub="Quelques cartes, 30 secondes" onPress={() => router.push({ pathname: '/recap/[week]', params: { week: String(rec) } })} />);
  return <>{cards.slice(0, 2)}</>;
}
function Ctx({ tag, title, sub, onPress }: { tag: string; title: string; sub: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.s3, backgroundColor: c.accentSoft, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s3, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}><Symbol size={20} /></View>
      <View style={{ flex: 1 }}><Tag tone="accent">{tag}</Tag><T v="label" style={{ marginTop: 4 }}>{title}</T><T v="small" muted>{sub}</T></View>
      <T v="h3" color={c.accent}>›</T>
    </Pressable>
  );
}
