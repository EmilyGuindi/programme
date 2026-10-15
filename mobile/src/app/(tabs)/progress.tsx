import { router } from 'expo-router';
import { Card, Row, Screen, T, Tag } from '@/components/ui';
import { mandatoryStats, runInsight, weightInsight, weightSeries, zones } from '@/engine/coach';
import { addDays, mmss, today } from '@/engine/dates';
import { useApp } from '@/store/store';
import { space } from '@/theme/tokens';

function Answer({ tag, value, unit, text, to }: { tag: string; value: string; unit?: string; text: string; to: string }) {
  return (
    <Card onPress={() => router.push({ pathname: '/progress/[view]', params: { view: to } })}>
      <Row between><Tag>{tag}</Tag><T muted>›</T></Row>
      <T v="hero" style={{ marginTop: space.s2 }}>{value}{unit ? <T v="h2" muted>{unit}</T> : null}</T>
      <T v="small" muted>{text}</T>
    </Card>
  );
}

export default function Progress() {
  const s = useApp(); const d = today();
  const st = mandatoryStats(s, addDays(d, -20), d); const ms = weightSeries(s); const last = ms[ms.length - 1]; const z = zones(s);
  const nStr = Object.keys(s.strength).length;
  return (
    <Screen>
      <T v="title" style={{ paddingTop: space.s4, paddingBottom: space.s3 }}>Progression</T>
      <Answer tag="Est-ce que je suis régulière ?" value={`${st.done}`} unit={` / ${st.planned}`} to="regularity"
        text={`séances obligatoires réalisées sur 3 semaines${st.adaptedN ? `, dont ${st.adaptedN} adaptée${st.adaptedN > 1 ? 's' : ''}` : ''}. Les promenades ne comptent pas.`} />
      <Answer tag="Est-ce que je progresse physiquement ?" value={last ? last.weight.toFixed(1).replace('.', ',') : '–'} unit=" kg" to="physique" text={weightInsight(s)} />
      <Answer tag="Est-ce que je cours mieux ?" value={mmss(z.p10)} unit=" /km" to="running" text={`Allure 10 km de référence (${z.src}). Objectif 5'30. ${runInsight(s)}`} />
      <Answer tag="Renforcement" value={`${nStr}`} unit={` séance${nStr > 1 ? 's' : ''}`} to="strength" text="Meilleures charges par exercice, séance après séance." />
    </Screen>
  );
}
