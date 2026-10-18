import { resultValue } from '@/engine/race';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import type React from 'react';
import { Stage, StatusMark } from '@/components/brand';
import { DayMini, dayStatus, WeekMeter, WeekTracker } from '@/components/week-tracker';
import { markDone, openDay, TYPE_LABEL } from '@/components/plan-row';
import { Button, Chevron, Chip, Divider, ListGroup, ListRow, Meta, Row, Screen, T } from '@/components/ui';
import { Icon } from '@/components/icons';
import { activitiesOn, adapted, doneOn, phaseOf, weekOf, weekStart } from '@/engine/coach';
import { eventState, weekSummary } from '@/engine/status';
import { movable } from '@/engine/reschedule';
import { sessionProgress, SESSION_LABEL } from '@/engine/session';
import { addDays, clock, daysBetween, dow, fmtShort, parseISO, sportDay } from '@/engine/dates';
import type { AdaptedPlan } from '@/engine/types';
import { update, useApp } from '@/store/store';
import { layout, radius, space, useTheme } from '@/theme/tokens';

const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
type Kind = 'pre' | 'event' | 'done' | 'rest' | 'optional' | 'planned';

export default function Program() {
  const s = useApp(); const { c } = useTheme(); const today = sportDay(); const { date: asked } = useLocalSearchParams<{ date?: string }>();
  const [w, setW] = useState(Math.min(s.program.weeks, Math.max(1, weekOf(s, today))));
  const ws = weekStart(s, w); const ph = phaseOf(w, s.program);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => adapted(s, addDays(ws, i))), [s, ws]);
  const inWeek = (d: string) => d >= ws && d <= addDays(ws, 6);
  const [sel, setSel] = useState<string>(inWeek(today) ? today : days.find(a => a.date >= s.user.startDate)?.date || ws);
  const selDay = days.find(a => a.date === sel) || days[0];
  const kind = (a: AdaptedPlan): Kind => a.date < s.user.startDate ? 'pre' : a.type === 'event' ? 'event' : doneOn(s, a.date) ? 'done' : a.type === 'rest' ? 'rest' : a.optional ? 'optional' : 'planned';
  const pre = days.filter(a => kind(a) === 'pre');
  const first = parseISO(ws), last = parseISO(addDays(ws, 6));
  const range = first.getMonth() === last.getMonth() ? `${first.getDate()} – ${last.getDate()} ${MONTHS[last.getMonth()]}` : `${first.getDate()} ${MONTHS[first.getMonth()].slice(0, 4)}. – ${last.getDate()} ${MONTHS[last.getMonth()].slice(0, 4)}.`;
  const upcoming = s.events.filter(e => ['upcoming', 'today'].includes(eventState(s, e, today)) && !inWeek(e.date)).sort((a, b) => a.date.localeCompare(b.date));
  // Ouvert depuis « Ta semaine » (Aujourd'hui) : la semaine et le jour touchés sont sélectionnés.
  useEffect(() => { if (asked) { setW(Math.min(s.program.weeks, Math.max(1, weekOf(s, asked)))); setSel(asked); } }, [asked]);
  const goWeek = (n: number) => { const nw = Math.min(s.program.weeks, Math.max(1, n)); setW(nw); const nws = weekStart(s, nw); setSel(nws <= today && today <= addDays(nws, 6) ? today : addDays(nws, 0) < s.user.startDate ? s.user.startDate : nws); };

  return (
    <Screen>
      <View style={{ paddingTop: space.s4 }}>
        <Row gap={space.s2}><T v="small" muted>{`Semaine ${w} sur ${s.program.weeks}`}</T><Chip label={ph.name} /></Row>
        <Row between style={{ marginTop: space.s1 }}>
          <T v="title" style={{ flex: 1 }} numberOfLines={1}>{range}</T>
          <Row gap={6}>
            <NavBtn label="Semaine précédente" glyph="‹" disabled={w <= 1} onPress={() => goWeek(w - 1)} />
            <NavBtn label="Semaine suivante" glyph="›" disabled={w >= s.program.weeks} onPress={() => goWeek(w + 1)} />
          </Row>
        </Row>
        <Row gap={space.s4} style={{ marginTop: space.s1 }}>
          <Button small kind="ghost" style={{ paddingHorizontal: 0 }} label="Mes programmes" onPress={() => router.push('/programs')} />
          <Button small kind="ghost" style={{ paddingHorizontal: 0 }} label="Demander au coach" onPress={() => router.push({ pathname: '/coach', params: { context: 'program' } })} />
        </Row>
      </View>

      <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: layout.pad, marginTop: space.s4, marginBottom: layout.gap }}>
        <WeekTracker s={s} start={ws} today={today} selected={sel} onSelect={setSel} />
        <WeekMeter w={weekSummary(s, ws, today)} />
      </View>

      <DayPanel a={selDay} today={today} />

      <ListGroup title="La semaine">
        {pre.length ? <ListRow title="Avant le début du programme" sub={`Démarrage le ${fmtShort(s.user.startDate)}`} chevron={false} leftWidth={36} left={<View />} /> : null}
        {days.filter(a => kind(a) !== 'pre').map((a, i, arr) => {
          const k = kind(a); const shown = a.replaced || a; const acts = activitiesOn(s, a.date).filter(x => !x.complementary);
          // Sous-titre : une phrase courte, jamais une suite de « · ».
          const sub = k === 'done' ? acts.map(x => `${x.title === shown.title ? 'Faite' : x.title}${x.durationMin ? `, ${Math.round(x.durationMin)} min` : ''}`).join(' ; ')
            : k === 'event' ? (() => { const es = eventState(s, a.event!, today); return es === 'cancelled' ? 'Annulée' : a.event?.result ? (a.event.type === 'crossfit-compet' ? `Terminée, ${resultValue(a.event, clock)}` : `Terminée en ${clock(a.event.result.time)}`) : es === 'done' ? 'Terminée, temps à saisir' : es === 'toConfirm' ? 'Résultat à confirmer' : a.event?.time ? `Départ à ${a.event.time.replace(':', ' h ')}` : 'Compétition'; })()
            : a.movedTo ? `Déplacée au ${fmtShort(a.movedTo)}`
            : (() => { const sp = sessionProgress(s, a.date, today); return sp.done ? `${SESSION_LABEL[sp.state]}, ${sp.done} sur ${sp.total}` : [shown.dur || (shown === a ? a.dur : ''), a.optional ? 'optionnelle' : '', a.reason ? 'adaptée' : '', a.movedFrom ? 'déplacée' : ''].filter(Boolean).join(', '); })();
          return (
            <ListRow key={a.date} last={i === arr.length - 1} title={shown.title} sub={sub || undefined}
              leftWidth={36} left={<View><T v="overline" color={a.date === today ? c.accent : c.ink3}>{DAY_NAMES[dow(a.date)].slice(0, 3)}</T><T v="num" style={{ fontSize: 18, lineHeight: 22 }} color={k === 'rest' ? c.ink3 : c.ink}>{parseISO(a.date).getDate()}</T></View>}
              right={<DayMini status={dayStatus(s, a, today)} a={a} />} onPress={() => (a.type === 'event' && a.event ? router.push({ pathname: '/race/[id]', params: { id: a.event.id } }) : openDay(a.date))} />
          );
        })}
      </ListGroup>

      <ListGroup title="Courses à venir">
        {upcoming.map(e => <ListRow key={e.id} title={e.name} sub={[fmtShort(e.date), e.distanceKm ? `${String(e.distanceKm).replace('.', ',')} km` : ''].filter(Boolean).join(', ')} left={<Icon name="flag" size={20} color={c.accent} />} right={<Chip tone="accent" label={`J-${daysBetween(today, e.date)}`} />} onPress={() => router.push({ pathname: '/race/[id]', params: { id: e.id } })} />)}
        <ListRow last title="Ajouter une course" left={<Icon name="plus" size={20} color={c.accent} />} onPress={() => router.push('/event')} chevron={false} />
      </ListGroup>
    </Screen>
  );
}

function NavBtn({ glyph, onPress, disabled, label }: { glyph: string; onPress: () => void; disabled?: boolean; label: string }) {
  const { c } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.surface2 : c.surface, opacity: disabled ? 0.35 : 1 })}><View style={{ transform: [{ rotate: glyph === '‹' ? '180deg' : '0deg' }] }}><Chevron color={c.ink} size={16} /></View></Pressable>;
}

/** Panneau du jour sélectionné : le moment expressif de l'écran. */
function DayPanel({ a, today }: { a: AdaptedPlan; today: string }) {
  const s = useApp(); const { c } = useTheme();
  const shown = a.replaced || a; const isEvent = a.type === 'event' && a.event; const done = doneOn(s, a.date);
  const acts = activitiesOn(s, a.date).filter(x => !x.complementary); const rel = a.date === today ? "Aujourd'hui" : a.date === addDays(today, 1) ? 'Demain' : DAY_NAMES[dow(a.date)];
  const bg = isEvent ? c.stage : c.surface; const fg = isEvent ? c.stageInk : c.ink; const fg2 = isEvent ? c.stageInk2 : c.ink2;
  const n = isEvent ? daysBetween(today, a.date) : 0;
  const evs = isEvent ? eventState(s, a.event!, today) : null; const evDone = evs === 'done'; const toConfirm = evs === 'toConfirm';
  const res = isEvent ? a.event!.result : undefined;
  const Wrap = ({ children }: { children: React.ReactNode }) => isEvent ? <Stage mark glow={!evDone}>{children}</Stage> : <View style={{ backgroundColor: bg, borderRadius: radius.r3, padding: layout.padHero, marginBottom: layout.gap }}>{children}</View>;
  // Un seul statut, une seule action utile.
  const sp = sessionProgress(s, a.date, today);
  const status = isEvent ? (evDone ? 'Terminée' : toConfirm ? 'À confirmer' : evs === 'cancelled' ? 'Annulée' : n === 0 ? 'Jour J' : n > 0 ? `J-${n}` : '') : done ? (sp.adapted || a.reason ? 'Faite, adaptée' : 'Faite') : sp.done ? SESSION_LABEL[sp.state] : a.movedFrom ? 'Déplacée' : a.reason ? 'Adaptée' : a.optional ? 'Optionnelle' : '';
  const tone = isEvent ? (evDone ? 'stage' : toConfirm ? 'warn' : 'accent') : done || sp.done ? 'accent' : a.reason ? 'warn' : 'neutral';
  const du = shown.dur || (shown === a ? a.dur : ''); const kind = isEvent ? 'Compétition' : TYPE_LABEL[shown.type];
  return (
    <Wrap>
      <Row between style={{ minHeight: 24 }}>
        <T v="small" color={fg2} style={{ fontWeight: '600' }}>{rel}</T>
        {status ? <Chip tone={tone as 'accent'} label={status} /> : null}
      </Row>
      <T v="h2" color={fg} style={{ fontSize: 24, lineHeight: 30, marginTop: space.s2 }}>{shown.title}</T>
      <Meta items={[kind, !evDone && du && !(shown.goal || '').includes(du) ? du : null]} color={fg2} style={{ marginTop: 2 }} />
      {evDone ? (
        <Row gap={8} style={{ alignItems: 'flex-end', marginTop: space.s2 }}>
          <T v="hero" color={c.accent}>{res ? resultValue(a.event!, clock) : '—'}</T>
          <T v="small" color={fg2} style={{ paddingBottom: 6 }}>{res ? (a.event!.type === 'crossfit-compet' ? (res.score || 'classement') : res.source === 'montre' ? 'temps montre' : 'temps officiel') : 'activité Strava reçue'}</T>
        </Row>
      ) : <>
        {shown.goal ? <T color={fg2} style={{ marginTop: space.s3 }}>{shown.goal}</T> : null}
        {a.reason ? <T v="small" color={fg2} style={{ marginTop: space.s2 }}>{a.reason}</T> : a.note ? <T v="small" color={fg2} style={{ marginTop: space.s2 }}>{a.note}</T> : null}
        {shown.type === 'rest' && !a.note && !shown.goal ? <T color={fg2} style={{ marginTop: 4 }}>Récupération. Une marche est bienvenue.</T> : null}
        {done && acts.length ? <View style={{ marginTop: space.s3, gap: 2 }}>{acts.map(x => <Meta key={x.id} items={[x.title, x.durationMin ? `${Math.round(x.durationMin)} min` : null, x.calories ? `${Math.round(x.calories)} kcal estimées` : null]} color={fg2} />)}</View> : null}
      </>}
      <View style={{ marginTop: space.s4 }}>
        {isEvent ? <Button kind="primary" block label={evDone ? (res?.feeling ? 'Voir mon analyse' : res ? 'Faire mon débrief' : 'Saisir mon temps') : toConfirm ? 'Saisir mon résultat' : evs === 'cancelled' ? 'Voir l\'événement' : 'Préparer la course'} onPress={() => ((evDone || toConfirm) && !res ? router.push({ pathname: '/result/[id]', params: { id: a.event!.id } }) : router.push({ pathname: '/race/[id]', params: { id: a.event!.id } }))} />
          : shown.type === 'run' || shown.type === 'renfo' ? <Button kind="primary" block label={done ? 'Revoir la séance' : 'Voir la séance'} onPress={() => router.push({ pathname: shown.type === 'run' ? '/run/[date]' : '/renfo/[date]', params: { date: a.date } })} />
          : !done && shown.type === 'recup' && a.date <= today ? <Button kind="primary" block label="Ouvrir la routine" onPress={() => openDay(a.date)} />
          : !done && shown.type === 'box' && a.date <= today ? <Button kind="primary" block label="Marquer comme fait" onPress={() => markDone(a)} />
          : null}
        {/* Actions secondaires : liens alignés à gauche, retour à la ligne propre si l'écran est étroit */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s5, marginTop: space.s1 }}>
          {!isEvent && (shown.type !== 'rest' || done) ? <Button small kind="ghost" label="Détail du jour" style={{ paddingHorizontal: 0 }} onPress={() => openDay(a.date)} /> : null}
          {movable(s, a.date, today).ok ? <Button small kind="ghost" label="Déplacer" style={{ paddingHorizontal: 0 }} onPress={() => router.push({ pathname: '/move/[date]', params: { date: a.date } })} /> : null}
          {a.movedTo ? <Button small kind="ghost" label="Voir la séance déplacée" style={{ paddingHorizontal: 0 }} onPress={() => openDay(a.movedTo!)} /> : null}
          {a.hyrox && a.date >= today ? <Button small kind="ghost" label="Pas de HYROX cette semaine" style={{ paddingHorizontal: 0 }} onPress={() => update(st => { st.overrides[a.date] = { ...(st.overrides[a.date] || {}), noHyrox: true }; })} /> : null}
          {a.alt && a.date >= today ? <Button small kind="ghost" label="Finalement, HYROX" style={{ paddingHorizontal: 0 }} onPress={() => update(st => { delete st.overrides[a.date].noHyrox; })} /> : null}
        </View>
      </View>
    </Wrap>
  );
}
export const _d = Divider;
