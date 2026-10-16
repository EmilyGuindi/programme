import { View } from 'react-native';
import { insights, type Insight } from '@/engine/insights';
import { sportDay } from '@/engine/dates';
import { useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';
import { Row, T } from './ui';
import { Confidence, Kicker } from './brand';

const LEVEL: Record<Insight['level'], string> = { observation: 'Observation', tendance: 'Tendance', confirmée: 'Progression confirmée' };

/** Insights d'un ou plusieurs domaines, avec leur niveau de confiance et leur source. Rien si les données manquent. */
export function Insights({ domains, max = 3, title = 'Ce que tes données montrent' }: { domains?: Insight['domain'][]; max?: number; title?: string }) {
  const s = useApp(); const { c } = useTheme();
  const list = insights(s, sportDay()).filter(i => !domains || domains.includes(i.domain)).slice(0, max);
  if (!list.length) return null;
  return (
    <View style={{ marginVertical: space.s3 }}>
      <Kicker>{title}</Kicker>
      <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, marginTop: space.s2 }}>
        {list.map((i, k) => (
          <View key={i.id} style={{ padding: space.s4, borderTopWidth: k ? 0.5 : 0, borderTopColor: c.line2 }}>
            <Row gap={8}><Confidence level={i.level} /><T v="overline" color={i.level === 'confirmée' ? c.ok : i.level === 'tendance' ? c.accent : c.ink2}>{LEVEL[i.level]}</T></Row>
            <T v="h3" style={{ marginTop: space.s2, fontSize: 17, lineHeight: 23 }}>{i.text}</T>
            <T v="xs" muted style={{ marginTop: 6 }}>{i.basis}</T>
          </View>
        ))}
      </View>
    </View>
  );
}
