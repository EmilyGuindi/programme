import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Icon } from '@/components/icons';
import { dayIcon } from '@/components/week-tracker';
import { Button, Row, Segmented, T } from '@/components/ui';
import { adapted, planFor } from '@/engine/coach';
import { addDays, dow, fmtDay, parseISO, sportDay } from '@/engine/dates';
import { applyMove, cancelMove, checkMove, habitFor, movable, setHabit, type MoveIssue } from '@/engine/reschedule';
import { haptic } from '@/feedback';
import { getState, update, useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';

const LETTER = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DAY = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** Déplacer une séance : choisir un jour, voir l'avis du coach, valider. Une occurrence ou le jour habituel. */
export default function MoveScreen() {
  const { date } = useLocalSearchParams<{ date: string }>(); const s = useApp(); const { c } = useTheme(); const today = sportDay();
  const p = planFor(s, date); const a = adapted(s, date); const origin = p.movedFrom || date; const habit = habitFor(s, date); const can = movable(s, date, today);
  const ws = addDays(date, -dow(date)); const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(ws, i)), [ws]);
  const [to, setTo] = useState<string | null>(null); const [mode, setMode] = useState<'once' | 'habit'>('once'); const [swap, setSwap] = useState(true); const [done, setDone] = useState<string | null>(null);
  const check = to ? checkMove(s, date, to, today) : null;

  function confirm() {
    if (!to || !check || check.verdict === 'block') return;
    const doSwap = !!check.swapWith && swap;
    update(st => {
      if (mode === 'habit' && habit) setHabit(st, habit.type, habit.dow, dow(to), addDays(origin, -dow(origin)));
      else applyMove(st, date, to, doSwap);
    });
    haptic('success');
    setDone(mode === 'habit' ? `${p.title} : chaque semaine le ${DAY[dow(to)]}, à partir de cette semaine. Les séances fixées par le calendrier des courses ne bougent pas.` : check.result);
  }

  if (done) return (
    <Sheet title="Séance déplacée" sub={fmtDay(date)}>
      <View style={{ backgroundColor: c.accentSoft, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s4 }}>
        <Row gap={8}><Icon name="check" size={18} color={c.accent} /><T v="label" color={c.accent}>Enregistré</T></Row>
        <T style={{ marginTop: 6 }}>{done}</T>
        <T v="small" muted style={{ marginTop: 6 }}>Aujourd'hui, Programme et tes rappels sont à jour. Tes coches et tes notes suivent la séance.</T>
      </View>
      <Button kind="primary" block label="Terminé" onPress={() => router.back()} />
      <View style={{ height: space.s2 }} />
      <Button kind="ghost" block label="Annuler ce déplacement" onPress={() => { update(st => { if (mode === 'habit' && habit) setHabit(st, habit.type, habit.dow, habit.dow, origin); else cancelMove(st, to!); }); haptic('select'); router.back(); }} />
    </Sheet>
  );

  return (
    <Sheet title="Déplacer la séance" sub={p.movedFrom ? `Prévue à l'origine ${fmtDay(p.movedFrom)}` : fmtDay(date)}
      footer={can.ok ? <Button kind={check?.verdict === 'warn' ? 'secondary' : 'primary'} block disabled={!to || check?.verdict === 'block'} label={!to ? 'Choisis un jour' : check?.verdict === 'block' ? 'Impossible ce jour-là' : `${check?.verdict === 'warn' ? 'Déplacer quand même' : 'Déplacer'} au ${fmtDay(to).replace(/ \d+ .*/, '')} ${parseISO(to).getDate()}`} onPress={confirm} /> : undefined}>
      {/* Séance d'origine */}
      <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s4 }}>
        <Row gap={space.s3}><Icon name={dayIcon(a)} size={22} color={c.accent} /><View style={{ flex: 1 }}><T v="label">{p.title}</T><T v="small" muted>{[p.dur, p.goal].filter(Boolean).join(' · ')}</T></View></Row>
        {p.movedFrom ? <Button small kind="ghost" style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: space.s2 }} label={`Revenir au ${fmtDay(p.movedFrom)}`} onPress={() => { update(st => cancelMove(st, date)); haptic('select'); router.back(); }} /> : null}
      </View>
      {!can.ok ? <T muted>{can.why}</T> : <>
        {habit ? <View style={{ marginBottom: space.s4 }}><Segmented options={[['once', 'Cette fois seulement'], ['habit', `Chaque ${DAY[habit.dow]}`]]} value={mode} onChange={setMode} /></View> : null}
        <T v="small" muted style={{ fontWeight: '600', marginBottom: space.s2 }}>{mode === 'habit' ? 'Nouveau jour habituel' : 'Nouveau jour'}</T>
        {/* Sélecteur : deux semaines, un jour = une case avec ce qui y est prévu */}
        {[0, 7].map(off => (
          <View key={off} style={{ flexDirection: 'row', gap: 4, marginBottom: 6 }}>
            {days.slice(off, off + 7).map(d => {
              const q = planFor(s, d); const past = d < today; const isFrom = d === date; const sel = d === to; const busy = q.type !== 'rest' || !!q.movedTo;
              return (
                <Pressable key={d} disabled={past || isFrom} accessibilityRole="radio" accessibilityState={{ selected: sel, disabled: past || isFrom }} aria-checked={sel}
                  accessibilityLabel={`${DAY[dow(d)]} ${parseISO(d).getDate()} : ${q.title}`} onPress={() => { haptic('select'); setTo(d); }}
                  style={{ flex: 1, minHeight: 64, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 3, opacity: past ? 0.3 : 1,
                    backgroundColor: isFrom ? c.surface2 : sel ? c.accentSoft : 'transparent', borderWidth: sel ? 2 : 1, borderColor: sel ? c.accent : isFrom ? c.surface2 : c.line2 }}>
                  <T v="xs" color={c.ink3} style={{ fontSize: 11, lineHeight: 13 }} maxFontSizeMultiplier={1.2}>{d === today ? 'Auj.' : LETTER[dow(d)]}</T>
                  <T v="num" style={{ fontSize: 16, lineHeight: 19 }} maxFontSizeMultiplier={1.2}>{parseISO(d).getDate()}</T>
                  {busy ? <Icon name={dayIcon(adapted(s, d))} size={12} color={isFrom ? c.accent : c.ink2} /> : <View style={{ height: 12 }} />}
                </Pressable>);
            })}
          </View>))}
        <T v="xs" muted style={{ marginBottom: space.s4 }}>Case grisée : jour actuel de la séance. Pictogramme : séance déjà prévue ce jour-là.</T>

        {check ? <Verdict issues={check.issues} verdict={check.verdict} result={check.result} /> : null}
        {check?.swapWith && check.verdict !== 'block' ? (
          <Pressable accessibilityRole="switch" aria-checked={swap} accessibilityState={{ checked: swap }} onPress={() => setSwap(!swap)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3, backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s3 }}>
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: swap ? 0 : 1.5, borderColor: c.stroke, backgroundColor: swap ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{swap ? <Icon name="check" size={14} color={c.accentInk} /> : null}</View>
            <T style={{ flex: 1 }}>{`Échanger : ${check.swapWith.title} passe au ${fmtDay(date)}`}</T>
          </Pressable>) : null}
        {check?.alternatives.length ? <View style={{ marginBottom: space.s3 }}>
          <T v="small" muted style={{ fontWeight: '600', marginBottom: space.s2 }}>Plutôt, sans conflit</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}><Row gap={space.s2}>{check.alternatives.map(x => <Button key={x.date} small label={x.label} onPress={() => { haptic('select'); setTo(x.date); }} />)}</Row></ScrollView>
        </View> : null}
      </>}
    </Sheet>
  );
}

function Verdict({ issues, verdict, result }: { issues: MoveIssue[]; verdict: 'ok' | 'warn' | 'block'; result: string }) {
  const { c } = useTheme();
  const col = verdict === 'ok' ? c.ok : verdict === 'warn' ? c.warn : c.stop; const bg = verdict === 'ok' ? c.okSoft : verdict === 'warn' ? c.warnSoft : c.stopSoft;
  const head = verdict === 'ok' ? 'Déplacement cohérent' : verdict === 'warn' ? 'Possible, avec une réserve' : 'Pas ce jour-là';
  return (
    <View accessibilityLiveRegion="polite" style={{ backgroundColor: bg, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s3, gap: 6 }}>
      <T v="label" color={col}>{head}</T>
      {issues.filter(i => i.severity !== 'info' || verdict === 'ok').map(i => <Row key={i.code} gap={8} style={{ alignItems: 'flex-start' }}><T v="small" color={i.severity === 'info' ? c.ink2 : col} style={{ fontWeight: '700' }}>{i.severity === 'info' ? '·' : '!'}</T><T v="small" style={{ flex: 1 }}>{i.text}</T></Row>)}
      {verdict !== 'block' ? <T v="small" muted>{result}</T> : null}
    </View>
  );
}
export const _g = getState;
