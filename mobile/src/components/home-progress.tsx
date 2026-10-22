import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { ask, ensureMemory, providerFor } from '@/ai/studio';
import { AchBadge } from '@/components/badges';
import { Icon } from '@/components/icons';
import { Chevron, Row, T } from '@/components/ui';
import { WeekMeter, WeekTracker } from '@/components/week-tracker';
import { achievementsMemo } from '@/engine/achievements';
import { daysBetween, sportDay } from '@/engine/dates';
import { localWord, momentum } from '@/engine/momentum';
import { weekSummary } from '@/engine/status';
import { weekOf, weekStart } from '@/engine/coach';
import { getState, update, useApp } from '@/store/store';
import { layout, radius, space, useTheme } from '@/theme/tokens';

const WORD_PROMPT = 'Mot du jour pour mon écran d\'accueil. Deux phrases au maximum (240 caractères), en me tutoyant : une observation vraie et précise sur ma progression ou ma régularité récente (chiffres du contexte), puis ce qui compte aujourd\'hui. Pas de liste, pas de gras, pas d\'outil, pas de question.';
let asking = '';

/** Le mot du coach : une phrase personnelle par jour. Claude l'écrit une fois par jour (un seul appel), sinon une phrase tirée des données. */
export function CoachWord() {
  const s = useApp(); const { c } = useTheme(); const d = sportDay();
  const daily = s.coach?.daily?.date === d ? s.coach.daily.text : null;
  const fallback = useMemo(() => localWord(s, d), [s, d]);
  useEffect(() => {
    if (daily || asking === d || providerFor(s).id !== 'claude') return;
    asking = d;
    ask(getState(), WORD_PROMPT, d).then(m => {
      const t = m.text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
      if (t && t.length <= 400 && !t.startsWith('(') && !/pas pu traiter/i.test(t)) update(st => { ensureMemory(st).daily = { date: d, text: t.slice(0, 320) }; });
    }).catch(() => { asking = ''; });
  }, [d, !!daily, providerFor(s).id]);
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4, marginBottom: layout.gap, gap: space.s3 }}>
      <Row gap={space.s3} style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="coach" size={17} color={c.accent} /></View>
        <View style={{ flex: 1 }}><T v="xs" muted style={{ fontWeight: '700', marginBottom: 2 }}>LE MOT DU COACH</T><T>{daily || fallback}</T></View>
      </Row>
      {/* Entrée directe : parler au coach de n'importe quoi */}
      <Pressable accessibilityRole="button" accessibilityLabel="Écrire au coach" onPress={() => router.push({ pathname: '/coach', params: { focus: '1' } })}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.s2, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: c.line2, backgroundColor: pressed ? c.surface2 : c.paper, paddingLeft: space.s4, paddingRight: 6 })}>
        <T muted style={{ flex: 1 }}>Écris à ton coach…</T>
        <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}><Icon name="mic" size={20} color={c.ink2} /></View>
      </Pressable>
    </View>
  );
}

/** Ma progression : la semaine, le programme, la série, le prochain jalon et la prochaine compétition, en une carte. */
export function ProgressCard() {
  const s = useApp(); const { c } = useTheme(); const d = sportDay(); const ach = achievementsMemo(s, d); const m = momentum(s, d, ach);
  const w = Math.min(s.program.weeks, Math.max(1, weekOf(s, d))); const ws = weekStart(s, w); const wk = weekSummary(s, ws, d);
  const pct = m.planned ? Math.round((m.done / m.planned) * 100) : 0;
  const fresh = m.lastUnlocked && daysBetween(m.lastUnlocked.date!, d) <= 7 ? m.lastUnlocked : null;
  const Stat = ({ v, l }: { v: string; l: string }) => <View style={{ flex: 1 }}><T v="num" style={{ fontSize: 24, lineHeight: 28 }} numberOfLines={1}>{v}</T><T v="xs" muted numberOfLines={2}>{l}</T></View>;
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, marginBottom: layout.gap, overflow: 'hidden' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Ma progression. Semaine ${m.week} sur ${m.weeks}. Ouvrir Progression`} onPress={() => router.navigate('/progress')} style={({ pressed }) => ({ padding: layout.pad, paddingBottom: space.s3, opacity: pressed ? 0.85 : 1 })}>
        <Row between style={{ marginBottom: space.s3 }}><T v="label">Ma progression</T><Row gap={6}><T v="small" muted>{`Semaine ${m.week} sur ${m.weeks}`}</T><Chevron /></Row></Row>
        <Row gap={space.s3}>
          <Stat v={`${m.done}/${m.planned}`} l={m.planned ? `séances faites, ${pct} %` : 'séances faites'} />
          <Stat v={`${m.streak}`} l={m.streak > 1 ? 'semaines réussies d\'affilée' : 'semaine réussie d\'affilée'} />
          {m.event ? <Stat v={m.eventIn === 0 ? 'Jour J' : `J-${m.eventIn}`} l={m.event.name} /> : <Stat v={`${m.daysLeft}`} l="jours avant la fin du programme" />}
        </Row>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.line, marginTop: space.s3 }}><View style={{ width: `${Math.round((Math.min(m.week, m.weeks) / m.weeks) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: c.accent }} /></View>
      </Pressable>
      <View style={{ paddingHorizontal: layout.pad, paddingBottom: space.s3 }}>
        <WeekTracker s={s} start={ws} today={d} onSelect={x => router.navigate({ pathname: '/program', params: { date: x } })} />
        <WeekMeter w={wk} />
      </View>
      {fresh || m.next ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/progress/[view]', params: { view: 'records' } })}
        style={({ pressed }) => ({ borderTopWidth: 0.5, borderTopColor: c.line2, padding: layout.pad, paddingTop: space.s3, flexDirection: 'row', gap: space.s3, alignItems: 'center', backgroundColor: pressed ? c.surface2 : 'transparent' })}>
        <AchBadge cat={(fresh || m.next)!.cat} status={fresh ? 'unlocked' : 'locked'} size={40} />
        <View style={{ flex: 1 }}>
          <T v="xs" muted style={{ fontWeight: '600' }}>{fresh ? 'Jalon atteint' : 'Prochain jalon'}</T>
          <T v="label" numberOfLines={1}>{(fresh || m.next)!.title}</T>
          {!fresh && m.next?.progress ? <><View style={{ height: 4, borderRadius: 2, backgroundColor: c.line, marginTop: 6 }}><View style={{ width: `${Math.min(100, Math.round((m.next.progress.value / m.next.progress.target) * 100))}%`, height: 4, borderRadius: 2, backgroundColor: c.accent }} /></View>
            <T v="xs" muted style={{ marginTop: 4 }}>{m.next.progress.label}</T></> : null}
        </View>
        <Chevron />
      </Pressable> : null}
    </View>
  );
}
