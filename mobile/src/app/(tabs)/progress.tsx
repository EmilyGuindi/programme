import { router } from 'expo-router';
import type { ComponentType } from 'react';
import { Pressable, View } from 'react-native';
import { IlluBody, IlluJourney, IlluPeak, IlluRegularity, IlluRun, IlluStrength } from '@/components/illustrations';
import { Screen, T } from '@/components/ui';
import { radius, space, useTheme } from '@/theme/tokens';
import { availableRecaps, buildRecap } from '@/engine/recap';
import { fmtShort } from '@/engine/dates';
import { useApp } from '@/store/store';

/** Les chiffres ne s'affichent qu'à la demande : chaque tuile ouvre sa vue détaillée. */
const TILES: { view: string; title: string; question: string; Illu: ComponentType<{ size?: number }> }[] = [
  { view: 'regularity', title: 'Régularité', question: 'Est-ce que je suis régulière ?', Illu: IlluRegularity },
  { view: 'running', title: 'Running', question: 'Est-ce que je cours mieux ?', Illu: IlluRun },
  { view: 'physique', title: 'Physique', question: 'Comment évolue mon corps ?', Illu: IlluBody },
  { view: 'strength', title: 'Renforcement', question: 'Est-ce que je deviens plus forte ?', Illu: IlluStrength },
  { view: 'journey', title: 'Mon parcours', question: 'Où j\'en suis, et la suite ?', Illu: IlluJourney },
  { view: 'records', title: 'Records et paliers', question: 'Mes meilleures marques', Illu: IlluPeak },
];

export default function Progress() {
  const { c } = useTheme(); const s = useApp(); const recaps = availableRecaps(s);
  return (
    <Screen>
      <T v="title" style={{ paddingTop: space.s4 }}>Progression</T>
      <T muted style={{ marginBottom: space.s4 }}>Touche une carte pour voir le détail.</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s3 }}>
        {TILES.map(({ view, title, question, Illu }) => (
          <Pressable key={view} accessibilityRole="button" accessibilityLabel={`${title}. ${question}`}
            onPress={() => router.push({ pathname: '/progress/[view]', params: { view } })}
            style={({ pressed }) => ({ flexBasis: '47%', flexGrow: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.r2, padding: space.s4, gap: space.s3, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
            <View style={{ backgroundColor: c.accentSoft, borderRadius: radius.r2, alignItems: 'center', justifyContent: 'center', paddingVertical: space.s4 }}><Illu size={64} /></View>
            <View><T v="label">{title}</T><T v="small" muted>{question}</T></View>
          </Pressable>
        ))}
      </View>
      <T v="h3" style={{ marginTop: space.s5, marginBottom: space.s2 }}>Bilans de la semaine</T>
      {recaps.length ? recaps.map(w => { const r = buildRecap(s, w); const seen = !!s.recapsSeen?.[String(w)]; return (
        <Pressable key={w} onPress={() => router.push({ pathname: '/recap/[week]', params: { week: String(w) } })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: seen ? c.surface : c.accentSoft, borderWidth: 1, borderColor: c.line, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s2, opacity: pressed ? 0.85 : 1 })}>
          <View><T v="label">{`Semaine ${w}${seen ? '' : ' · nouveau'}`}</T><T v="small" muted>{`${fmtShort(r.from)} – ${fmtShort(r.to)}`}</T></View><T v="h3" color={c.accent}>›</T>
        </Pressable>); }) : <T v="small" muted>Ton premier bilan arrivera dimanche soir.</T>}
    </Screen>
  );
}
