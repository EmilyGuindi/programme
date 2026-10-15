import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { activitiesOn, doneOn } from '@/engine/coach';
import { DAYS_SHORT, dow, fmtShort, today } from '@/engine/dates';
import type { Activity, AdaptedPlan } from '@/engine/types';
import { getState, update } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';
import { Button, Row, T, Tag, Tick } from './ui';

export const TYPE_LABEL = { box: 'Box', run: 'Running', renfo: 'Renforcement', rest: 'Repos', recup: 'Récupération', event: 'Événement' } as const;

export function openPlan(a: AdaptedPlan) {
  const s = a.replaced || a;
  if (a.type === 'event' && a.event) router.push({ pathname: '/event', params: { id: a.event.id } });
  else if (s.type === 'run' || ('run' in s && s.run)) router.push({ pathname: '/run/[date]', params: { date: a.date } });
  else if (s.type === 'renfo') router.push({ pathname: '/renfo/[date]', params: { date: a.date } });
  else openDay(a.date);
}
export const openDay = (date: string) => router.push({ pathname: '/day/[date]', params: { date } });
export function presetFor(a: AdaptedPlan) { return a.hyrox ? 'hyrox' : a.type === 'box' ? 'crossfit' : a.type === 'run' ? 'running' : a.type === 'renfo' ? 'renfo' : 'marche'; }

export function PlanRow({ a, showDay = true }: { a: AdaptedPlan; showDay?: boolean }) {
  const { c } = useTheme();
  const s = getState(); const shown = a.replaced || a; const done = doneOn(s, a.date); const acts = activitiesOn(s, a.date);
  const isToday = a.date === today();
  const stripe = a.type === 'event' ? c.accent : shown.type === 'run' ? c.accent : shown.type === 'box' ? c.ink : shown.type === 'renfo' ? c.ink2 : 'transparent';
  const sub = done ? acts.filter(x => !x.complementary).map(x => x.title + (x.durationMin ? ` ${Math.round(x.durationMin)} min` : '')).join(', ') : [shown === a ? a.dur : '', shown.type !== 'box' ? shown.goal : a.note].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={() => (a.type === 'event' && a.event ? openPlan(a) : openDay(a.date))} accessibilityRole="button" accessibilityHint="Voir le détail du jour"
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.s3, backgroundColor: a.type === 'event' ? c.accentSoft : c.surface, borderWidth: isToday ? 2 : 1, borderColor: isToday ? c.accent : c.line, borderLeftWidth: 4, borderLeftColor: stripe, borderStyle: shown.type === 'run' ? 'dashed' : 'solid', borderRadius: radius.r2, paddingVertical: space.s3, paddingHorizontal: space.s4, minHeight: 72, opacity: pressed ? 0.85 : 1 })}>
      {showDay ? <View style={{ width: 44 }}><T v="label">{DAYS_SHORT[dow(a.date)]}</T><T v="xs" muted>{fmtShort(a.date)}</T></View> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Row gap={6} style={{ flexWrap: 'wrap' }}><T v="label">{shown.title}{done ? '  ✓' : ''}</T>{a.optional && !done ? <Tag>optionnel</Tag> : null}{a.reason ? <Tag tone="accent">adaptée</Tag> : null}</Row>
        {sub ? <T v="small" muted numberOfLines={2}>{sub}{acts.some(x => x.complementary) ? ' · + marche' : ''}</T> : null}
      </View>
      {a.hyrox && a.date >= today() ? <Button small label="Pas de HYROX" onPress={() => update(st => { st.overrides[a.date] = { ...(st.overrides[a.date] || {}), noHyrox: true }; })} /> : null}
      {a.alt && a.date >= today() ? <Button small kind="ghost" label="HYROX" onPress={() => update(st => { delete st.overrides[a.date].noHyrox; })} /> : null}
      {a.type !== 'rest' || done ? <Tick on={done} label="Fait" onPress={() => toggleDone(a)} /> : null}
    </Pressable>
  );
}

export function toggleDone(a: AdaptedPlan) {
  const s = getState();
  if (doneOn(s, a.date)) {
    const manual = s.activities.filter(x => x.date === a.date && !x.complementary && x.source === 'manuel' && !x.eventId);
    if (manual.length) update(st => { st.activities = st.activities.filter(x => !manual.some(m => m.id === x.id)); });
  } else router.push({ pathname: '/activity', params: { date: a.date, preset: presetFor(a) } });
}

export function ActivityRow({ x }: { x: Activity }) {
  const { c } = useTheme();
  const meta = [x.durationMin ? `${Math.round(x.durationMin)} min` : '', x.distanceKm ? `${String(x.distanceKm).replace('.', ',')} km` : '', x.effort ? `effort ${x.effort}/10` : ''].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={() => router.push({ pathname: '/activity', params: { id: x.id } })} style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.r2, padding: space.s3, paddingHorizontal: space.s4, marginBottom: space.s2 }}>
      <Row between><View style={{ flex: 1 }}><Row gap={6}><T v="label">{x.title}</T>{x.complementary ? <Tag>complémentaire</Tag> : null}</Row>{meta ? <T v="small" muted>{meta}</T> : null}</View><T v="small" color={c.accent}>Modifier</T></Row>
    </Pressable>
  );
}
