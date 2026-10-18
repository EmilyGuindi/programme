import type React from 'react';
import { haptic } from '@/feedback';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { GlassSurface } from '@/components/glass';
import { Icon } from '@/components/icons';
import { Sheet } from '@/components/sheet';
import { Button, Row, T } from '@/components/ui';
import { adapted, coachLine, planFor, recovery } from '@/engine/coach';
import { addDays, daysBetween, fmtShort, sportDay } from '@/engine/dates';
import { MOBILITY } from '@/engine/guides';
import { RECUP } from '@/engine/library';
import { insights } from '@/engine/insights';
import { acceptProposal, keepProgram, proposals } from '@/engine/proactive';
import { nextEvent, taperTips } from '@/engine/race';
import { update, useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';

type Topic = 'today' | 'progress' | 'next' | 'recover';
const TOPICS: [Topic, string][] = [['today', 'Adapter ma séance'], ['progress', 'Ma progression'], ['next', 'Ma prochaine sortie'], ['recover', 'Récupérer']];

/** Coach BYYND : recommandations construites à partir de tes données et des règles du programme (pas d'IA générative).
 *  Une suggestion n'est appliquée qu'après « Appliquer » ; la confirmation n'apparaît qu'une fois enregistrée. */
export default function CoachScreen() {
  const s = useApp(); const { c } = useTheme(); const d = sportDay(); const a = adapted(s, d); const r = recovery(s, d);
  const [topic, setTopic] = useState<Topic>('today'); const [saved, setSaved] = useState('');
  const props = proposals(s, d); const ins = insights(s, d); const ev = nextEvent(s, d, 30);
  const shown = a.replaced || a; const hardToday = planFor(s, d).type === 'run' || planFor(s, d).type === 'renfo';
  const nextRun = Array.from({ length: 8 }, (_, i) => adapted(s, addDays(d, i))).find(x => x.type === 'run' && x.run && x.date >= d);

  const Msg = ({ children }: { children: React.ReactNode }) => <View style={{ marginBottom: space.s4 }}>{children}</View>;
  const apply = (label: string, fn: () => void) => { fn(); haptic('success'); setSaved(label); };
  const planB = (kind: 'easy' | 'reduced' | 'rest', reason: string) => update(st => { st.overrides[d] = { ...(st.overrides[d] || {}), adj: { kind, reason, proposalId: `coach-${d}` } }; });

  return (
    <Sheet title="Coach" sub={`${r.level === 'inconnu' ? 'Check-in à faire' : r.level === 'vert' ? 'Récupération : prête' : r.level === 'orange' ? 'Récupération : à surveiller' : 'Récupération : faible'}, S${a.week}`}>
      <Msg><T v="h3" style={{ lineHeight: 26 }}>{coachLine(s, d)}</T>{r.level !== 'inconnu' ? <T v="small" muted style={{ marginTop: 6 }}>{r.reasons.join(' ')}</T> : null}</Msg>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.s5 }}>
        {TOPICS.map(([k, l]) => (
          <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: topic === k }} onPress={() => { setTopic(k); setSaved(''); haptic('select'); }}>
            <View style={{ borderRadius: 20, backgroundColor: topic === k ? c.accent : c.surface2 }}><T v="small" color={topic === k ? c.accentInk : c.ink} style={{ paddingHorizontal: 16, paddingVertical: 10, fontWeight: '600' }}>{l}</T></View>
          </Pressable>))}
      </View>

      {saved ? <View style={{ backgroundColor: c.okSoft, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s4 }}><T v="label" color={c.ok}>Enregistré dans ton programme</T><T v="small">{saved}</T></View> : null}

      {topic === 'today' ? <>
        <Msg><T>{`Aujourd'hui : ${shown.title}${a.dur && !a.replaced ? `, ${a.dur}` : ''}.`}</T>{a.reason ? <T v="small" muted style={{ marginTop: 4 }}>{a.reason}</T> : null}</Msg>
        {props.map(p => (
          <ActionCard key={p.id} title={p.title} lines={[...p.changes.map(x => x.label), p.why]} caution={p.caution}
            onApply={() => apply(p.changes.map(x => x.label).join(', '), () => update(st => acceptProposal(st, p)))} onKeep={() => update(st => keepProgram(st, p))} />))}
        {hardToday && !s.overrides[d]?.adj ? <>
          <T v="small" muted style={{ fontWeight: '600', marginBottom: space.s2 }}>Si la séance prévue ne passe pas aujourd'hui</T>
          <ActionCard title="Version facile" lines={['La séance devient un footing facile ou un renforcement réduit.', 'Utile si tu es fatiguée ou courbaturée.']} onApply={() => { planB(planFor(s, d).type === 'renfo' ? 'reduced' : 'easy', 'Plan B choisi avec le coach : version facile.'); setSaved('Séance du jour passée en version facile.'); haptic('success'); }} />
          <ActionCard title="Récupération active" lines={[RECUP.goal, 'À choisir en cas de douleur ou de grosse fatigue.']} onApply={() => { planB('rest', 'Plan B choisi avec le coach : récupération active.'); setSaved('Séance du jour remplacée par une récupération active.'); haptic('success'); }} />
        </> : null}
        {s.overrides[d]?.adj ? <Button kind="ghost" label="Revenir à la séance prévue" style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} onPress={() => { update(st => { delete st.overrides[d].adj; }); setSaved('Séance prévue rétablie.'); }} /> : null}
      </> : null}

      {topic === 'progress' ? (ins.length ? ins.slice(0, 4).map(i => <Msg key={i.id}><T v="overline" color={i.level === 'confirmée' ? c.ok : i.level === 'tendance' ? c.accent : c.ink2}>{i.level === 'confirmée' ? 'Progression confirmée' : i.level === 'tendance' ? 'Tendance' : 'Observation'}</T><T style={{ marginTop: 2 }}>{i.text}</T><T v="xs" muted style={{ marginTop: 2 }}>{i.basis}</T></Msg>)
        : <Msg><T>Pas encore assez de séances comparables pour parler de progression. Continue tes footings sur le même parcours : dès 3 sorties comparables, je te dirai ce qui évolue.</T></Msg>) : null}

      {topic === 'next' ? <>
        {ev && ev.type === 'course' ? <Msg><T v="overline" color={c.accent}>{`${ev.name}, J-${daysBetween(d, ev.date)}`}</T><T style={{ marginTop: 4 }}>{taperTips(ev, d)[0]}</T><Button kind="ghost" label="Voir ma stratégie" style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} onPress={() => router.push({ pathname: '/race/[id]', params: { id: ev.id } })} /></Msg> : null}
        {nextRun ? <ActionCard title={`${nextRun.date === d ? "Aujourd'hui" : fmtShort(nextRun.date)}, ${nextRun.run!.title}`} lines={[nextRun.run!.goal, ...nextRun.run!.steps.map(x => x.text)]} applyLabel="Ouvrir la séance" onApply={() => router.push({ pathname: '/run/[date]', params: { date: nextRun.date } })} />
          : <Msg><T>Pas de sortie prévue dans les 7 prochains jours.</T></Msg>}
      </> : null}

      {topic === 'recover' ? <>
        <Msg><T>{r.level === 'rouge' || r.level === 'orange' ? 'Ton check-in montre de la fatigue : une vraie récupération vaut mieux qu\'une séance forcée.' : 'Récupérer fait partie de l\'entraînement : c\'est là que tu progresses.'}</T></Msg>
        <ActionCard title="Routine de mobilité, 10 min" lines={MOBILITY.slice(1).map(m => `${m.name}, ${m.dose}`)} applyLabel="Ouvrir la routine" onApply={() => router.push({ pathname: '/day/[date]', params: { date: d } })} />
      </> : null}

      <T v="xs" muted style={{ marginTop: space.s4 }}>Les recommandations viennent des règles de ton programme et de tes données (check-ins, séances, Strava). Rien ne change sans ton accord. Elles ne remplacent pas un avis médical.</T>
    </Sheet>
  );
}

function ActionCard({ title, lines, caution, onApply, onKeep, applyLabel = 'Appliquer' }: { title: string; lines: string[]; caution?: string; onApply: () => void; onKeep?: () => void; applyLabel?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s3 }}>
      <Row gap={8}><Icon name="coach" size={18} color={c.accent} /><T v="label" style={{ flex: 1 }}>{title}</T></Row>
      <View style={{ marginTop: space.s2, gap: 4 }}>{lines.map((l, i) => <T key={i} v="small" muted={i > 0}>{l}</T>)}</View>
      {caution ? <T v="small" color={c.warn} style={{ marginTop: 6 }}>{caution}</T> : null}
      <Row style={{ marginTop: space.s3 }}>
        <Button kind="primary" label={applyLabel} style={{ flex: 1 }} onPress={onApply} />
        {onKeep ? <Button label="Garder mon programme" style={{ flex: 1 }} onPress={onKeep} /> : null}
      </Row>
    </View>
  );
}
