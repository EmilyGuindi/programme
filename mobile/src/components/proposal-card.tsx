import * as Haptics from 'expo-haptics';
import { View } from 'react-native';
import { acceptProposal, keepProgram, proposals } from '@/engine/proactive';
import { update, useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';
import { Bullets } from './guide';
import { Button, Row, T, Tag } from './ui';

/** Proposition du coach : ce qui change, pourquoi, l'impact. Rien n'est appliqué sans accord. Une seule à la fois. */
export function ProposalCard({ d }: { d: string }) {
  const s = useApp(); const { c } = useTheme();
  const p = proposals(s, d)[0]; if (!p) return null;
  return (
    <View style={{ backgroundColor: c.surface, borderWidth: 2, borderColor: c.accent, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s3 }}>
      <Tag tone="accent">Le coach propose</Tag>
      <T v="h3" style={{ marginTop: space.s2 }}>{p.title}</T>
      <T v="label" style={{ marginTop: space.s3 }}>Ce qui change</T><Bullets items={p.changes.map(x => x.label)} />
      <T v="small" style={{ marginTop: space.s2 }}><T v="small" style={{ fontWeight: '600' }}>Pourquoi : </T>{p.why}</T>
      <T v="small" style={{ marginTop: 4 }}><T v="small" style={{ fontWeight: '600' }}>Pour ton objectif : </T>{p.impact}</T>
      {p.caution ? <T v="small" color={c.stop} style={{ marginTop: 6 }}>{p.caution}</T> : null}
      <Row style={{ marginTop: space.s3 }}>
        <Button kind="primary" label="Accepter" style={{ flex: 1 }} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); update(st => acceptProposal(st, p)); }} />
        <Button label="Garder mon programme" style={{ flex: 1 }} onPress={() => update(st => keepProgram(st, p))} />
      </Row>
    </View>
  );
}
