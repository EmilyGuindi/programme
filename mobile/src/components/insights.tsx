import { View } from 'react-native';
import { insights, type Insight } from '@/engine/insights';
import { sportDay } from '@/engine/dates';
import { useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';
import { T } from './ui';

const LEVEL: Record<Insight['level'], string> = { observation: 'Observation', tendance: 'Tendance', confirmée: 'Progression confirmée' };

/** Insights d'un ou plusieurs domaines, avec leur niveau de confiance et leur source. Rien si les données manquent. */
export function Insights({ domains, max = 3, title = 'Ce que tes données montrent' }: { domains?: Insight['domain'][]; max?: number; title?: string }) {
  const s = useApp(); const { c } = useTheme();
  const list = insights(s, sportDay()).filter(i => !domains || domains.includes(i.domain)).slice(0, max);
  if (!list.length) return null;
  return (
    <View style={{ marginVertical: space.s3 }}>
      <T v="h3" style={{ marginBottom: space.s2 }}>{title}</T>
      {list.map(i => (
        <View key={i.id} style={{ borderLeftWidth: 4, borderLeftColor: i.level === 'confirmée' ? c.ok : i.level === 'tendance' ? c.accent : c.line2, backgroundColor: c.surface, borderTopRightRadius: radius.r2, borderBottomRightRadius: radius.r2, padding: space.s3, paddingLeft: space.s4, marginBottom: space.s2 }}>
          <T v="xs" color={i.level === 'confirmée' ? c.ok : i.level === 'tendance' ? c.accent : c.ink2} style={{ fontWeight: '600', marginBottom: 2 }}>{LEVEL[i.level]}</T>
          <T>{i.text}</T>
          <T v="xs" muted style={{ marginTop: 4 }}>{`Basé sur : ${i.basis}`}</T>
        </View>
      ))}
    </View>
  );
}
