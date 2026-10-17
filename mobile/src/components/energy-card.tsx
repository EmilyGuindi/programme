import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { addDays } from '@/engine/dates';
import { energy, type EnergyCat } from '@/engine/energy';
import type { AppState } from '@/engine/types';
import { radius, space, useTheme } from '@/theme/tokens';
import { Icon } from './icons';
import { Row, T } from './ui';

const CATS: [EnergyCat, string][] = [['entraînement', 'Programme'], ['complémentaire', 'Complémentaire'], ['promenade', 'Promenades'], ['récupération', 'Récup']];

/** ActivityEnergyCard : dépense estimée des activités (montre via Strava). Jamais présentée comme exhaustive. */
export function ActivityEnergyCard({ s, today, compact }: { s: AppState; today: string; compact?: boolean }) {
  const { c } = useTheme(); const e = energy(s, addDays(today, -6), today);
  const cols = { entraînement: c.series1, complémentaire: c.series2, promenade: c.series3, récupération: c.series4 } as Record<EnergyCat, string>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={e.withData ? `Dépense estimée des 7 derniers jours : ${e.total} kilocalories` : 'Dépense des activités'} onPress={() => router.push({ pathname: '/progress/[view]', params: { view: 'energy' } })}
      style={({ pressed }) => ({ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s3, opacity: pressed ? 0.88 : 1 })}>
      <Row between><Row gap={6}><Icon name="flame" size={16} color={c.ink2} /><T v="small" muted style={{ fontWeight: '600' }}>Activité · 7 jours</T></Row><T v="xs" muted>{e.withData ? `${e.withData}/${e.count} avec estimation` : ''}</T></Row>
      {e.withData ? <>
        <Row gap={6} style={{ alignItems: 'flex-end', marginTop: space.s2 }}><T v="hero">{e.total.toLocaleString('fr-FR')}</T><T muted style={{ paddingBottom: 6 }}>kcal estimées</T></Row>
        <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: space.s3, backgroundColor: c.line, gap: 2 }}>
          {CATS.filter(([k]) => e.byCat[k].kcal > 0).map(([k]) => <View key={k} style={{ flex: e.byCat[k].kcal, backgroundColor: cols[k] }} />)}
        </View>
        {!compact ? null : <Row gap={12} style={{ marginTop: space.s2, flexWrap: 'wrap' }}>{CATS.filter(([k]) => e.byCat[k].kcal > 0).map(([k, l]) => <Row key={k} gap={5}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cols[k] }} /><T v="xs" muted>{l}</T></Row>)}</Row>}
      </> : <T v="small" muted style={{ marginTop: space.s2 }}>{e.count ? 'Pas encore d\'estimation de ta montre sur ces activités.' : 'Aucune activité ces 7 derniers jours.'}</T>}
    </Pressable>
  );
}
