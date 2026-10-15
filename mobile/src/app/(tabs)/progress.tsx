import { router } from 'expo-router';
import type { ComponentType } from 'react';
import { Pressable, View } from 'react-native';
import { IlluBody, IlluRegularity, IlluRun, IlluStrength } from '@/components/illustrations';
import { Screen, T } from '@/components/ui';
import { radius, space, useTheme } from '@/theme/tokens';

/** Les chiffres ne s'affichent qu'à la demande : chaque tuile ouvre sa vue détaillée. */
const TILES: { view: string; title: string; question: string; Illu: ComponentType<{ size?: number }> }[] = [
  { view: 'regularity', title: 'Régularité', question: 'Est-ce que je suis régulière ?', Illu: IlluRegularity },
  { view: 'running', title: 'Running', question: 'Est-ce que je cours mieux ?', Illu: IlluRun },
  { view: 'physique', title: 'Physique', question: 'Comment évolue mon corps ?', Illu: IlluBody },
  { view: 'strength', title: 'Renforcement', question: 'Est-ce que je deviens plus forte ?', Illu: IlluStrength },
];

export default function Progress() {
  const { c } = useTheme();
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
    </Screen>
  );
}
