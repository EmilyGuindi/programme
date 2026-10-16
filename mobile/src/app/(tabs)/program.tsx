import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import type React from 'react';
import { Stage } from '@/components/brand';
import { openDay, presetFor, TYPE_LABEL } from '@/components/plan-row';
import { Button, Divider, ListGroup, ListRow, Meter, Row, Screen, T } from '@/components/ui';
import { activitiesOn, adapted, doneOn, phaseOf, weekOf, weekStart } from '@/engine/coach';
import { addDays, clock, daysBetween, dow, fmtShort, parseISO, sportDay } from '@/engine/dates';
import type { AdaptedPlan } from '@/engine/types';
import { update, useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';

const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
type Kind = 'pre' | 'event' | 'done' | 'rest' | 'optional' | 'planned';

export default function Program() {
  const s = useApp(); const { c } = useTheme(); const today = sportDay();
  const [w, setW] = useState(Math.min(s.program.weeks, Math.max(1, weekOf(s, today))));
  const ws = weekStart(s, w); const ph = phaseOf(w);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => adapted(s, addDays(ws, i))), [s, ws]);
  const inWeek = (d: string) => d >= ws && d <= addDays(ws, 6);
  const [sel, setSel] = useState<string>(inWeek(today) ? today : days.find(a => a.date >= s.user.startDate)?.date || ws);
  const selDay = days.find(a => a.date === sel) || days[0];
  const kind = (a: AdaptedPlan): Kind => a.date < s.user.startDate ? 'pre' : a.type === 'event' ? 'event' : doneOn(s, a.date) ? 'done' : a.type === 'rest' ? 'rest' : a.optional ? 'optional' : 'planned';
  const planned = days.filter(a => a.mandatory && !a.skipped && a.type !== 'event'); const done = planned.filter(a => doneOn(s, a.date)).length;
  const pre = days.filter(a => kind(a) === 'pre');
  const first = parseISO(ws), last = parseISO(addDays(ws, 6));
  const range = first.getMonth() === last.getMonth() ? `${first.getDate()} – ${last.getDate()} ${MONTHS[last.getMonth()]}` : `${first.getDate()} ${MONTHS[first.getMonth()].slice(0, 4)}. – ${last.getDate()} ${MONTHS[last.getMonth()].slice(0, 4)}.`;
  const upcoming = s.events.filter(e => e.status !== 'annulé' && !e.result && e.date >= today && !inWeek(e.date)).sort((a, b) => a.date.localeCompare(b.date));
  const goWeek = (n: number) => { const nw = Math.min(s.program.weeks, Math.max(1, n)); setW(nw); const nws = weekStart(s, nw); setSel(nws <= today && today <= addDays(nws, 6) ? today : addDays(nws, 0) < s.user.startDate ? s.user.startDate : nws); };

  return (
    <Screen>
      <View style={{ paddingTop: space.s4 }}>
        <T v="overline" muted>{`Semaine ${w} sur ${s.program.weeks} · Phase ${ph.n} · ${ph.name}`}</T>
        <Row between style={{ marginTop: 4 }}>
          <T v="title">{range}</T>
          <Row gap={6}>
            <NavBtn label="Semaine précédente" glyph="‹" disabled={w <= 1} onPress={() => goWeek(w - 1)} />
            <NavBtn label="Semaine suivante" glyph="›" disabled={w >= s.program.weeks} onPress={() => goWeek(w + 1)} />
          </Row>
        </Row>
      </View>

      {/* Bande de la semaine : un jour = une colonne, l'état se lit d'un coup d'œil */}
      <View style={{ flexDirection: 'row', marginTop: space.s4, marginBottom: space.s3 }}>
        {days.map((a, i) => {
          const k = kind(a); const isToday = a.date === today; const isSel = a.date === sel;
          const fg = isToday ? c.stageInk : k === 'pre' ? c.ink3 : c.ink;
          return (
            <Pressable key={a.date} disabled={k === 'pre'} accessibilityRole="button" accessibilityState={{ selected: isSel }} accessibilityLabel={`${DAY_NAMES[i]} ${parseISO(a.date).getDate()}, ${(a.replaced || a).title}`}
              onPress={() => setSel(a.date)} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ alignItems: 'center', paddingVertical: 8, width: 44, borderRadius: 22, backgroundColor: isToday ? c.stage : 'transparent' }}>
                <T v="overline" color={isToday ? c.stageInk2 : c.ink3}>{LETTERS[i]}</T>
                <T v="num" color={fg} style={{ marginTop: 2 }}>{parseISO(a.date).getDate()}</T>
                <View style={{ height: 12, justifyContent: 'center', marginTop: 4 }}><Glyph k={k} onStage={isToday} /></View>
              </View>
              <View style={{ height: 3, width: 20, borderRadius: 2, marginTop: 6, backgroundColor: isSel ? c.accent : 'transparent' }} />
            </Pressable>
          );
        })}
      </View>

      {planned.length ? <View style={{ marginBottom: space.s4 }}>
        <Row between style={{ marginBottom: 8 }}><T v="small" muted>{`Réalisé : ${done} sur ${planned.length} séance${planned.length > 1 ? 's' : ''} prévue${planned.length > 1 ? 's' : ''}`}</T><Legend /></Row>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: c.line2 }}><View style={{ width: `${(done / planned.length) * 100}%`, height: 4, borderRadius: 2, backgroundColor: c.ok }} /></View>
      </View> : null}

      <DayPanel a={selDay} today={today} />

      <ListGroup title="La semaine">
        {pre.length ? <ListRow title="Avant le début du programme" sub={`${pre.length} jour${pre.length > 1 ? 's' : ''} · démarrage le 14 octobre`} chevron={false} left={<View style={{ width: 36 }} />} /> : null}
        {days.filter(a => kind(a) !== 'pre').map((a, i, arr) => {
          const k = kind(a); const shown = a.replaced || a; const acts = activitiesOn(s, a.date).filter(x => !x.complementary);
          const sub = k === 'done' ? acts.map(x => `${x.title === shown.title ? 'Fait' : x.title}${x.durationMin ? ` · ${Math.round(x.durationMin)} min` : ''}`).join(', ') : k === 'event' ? (a.event?.time ? `Départ ${a.event.time}` : 'Compétition') : [shown === a ? a.dur : '', a.optional ? 'optionnel' : '', a.reason ? 'adaptée' : ''].filter(Boolean).join(' · ');
          return (
            <ListRow key={a.date} last={i === arr.length - 1} title={shown.title} sub={sub || undefined}
              left={<View style={{ width: 36 }}><T v="overline" color={a.date === today ? c.accent : c.ink3}>{DAY_NAMES[dow(a.date)].slice(0, 3)}</T><T v="num" style={{ fontSize: 18, lineHeight: 20 }} color={k === 'rest' ? c.ink3 : c.ink}>{parseISO(a.date).getDate()}</T></View>}
              right={<Glyph k={k} large />} onPress={() => (a.type === 'event' && a.event ? router.push({ pathname: '/race/[id]', params: { id: a.event.id } }) : openDay(a.date))} />
          );
        })}
      </ListGroup>

      <ListGroup title="Courses à venir">
        {upcoming.map(e => <ListRow key={e.id} title={e.name} sub={`${fmtShort(e.date)} · J-${daysBetween(today, e.date)}${e.distanceKm ? ` · ${String(e.distanceKm).replace('.', ',')} km` : ''}`} onPress={() => router.push({ pathname: '/race/[id]', params: { id: e.id } })} />)}
        <ListRow last title="Ajouter une course" left={<T v="h3" color={c.accent}>+</T>} onPress={() => router.push('/event')} chevron={false} />
      </ListGroup>
    </Screen>
  );
}

function NavBtn({ glyph, onPress, disabled, label }: { glyph: string; onPress: () => void; disabled?: boolean; label: string }) {
  const { c } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={6} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.surface2 : c.surface, opacity: disabled ? 0.35 : 1 })}><T v="h2" style={{ lineHeight: 26 }}>{glyph}</T></Pressable>;
}

/** Glyphes d'état : plein = fait, anneau = prévu, pointillé = optionnel, tiret = repos, carré cobalt = compétition. */
function Glyph({ k, onStage, large }: { k: Kind; onStage?: boolean; large?: boolean }) {
  const { c } = useTheme(); const z = large ? 12 : 8; const ink = onStage ? c.stageInk : c.ink;
  if (k === 'done') return large ? <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.ok, alignItems: 'center', justifyContent: 'center' }}><T v="xs" color="#fff" style={{ fontWeight: '700' }}>✓</T></View> : <View style={{ width: z, height: z, borderRadius: z / 2, backgroundColor: onStage ? c.stageInk : c.ok }} />;
  if (k === 'event') return <View style={{ width: z, height: z, borderRadius: 2, backgroundColor: c.accent, transform: [{ rotate: '45deg' }] }} />;
  if (k === 'planned') return <View style={{ width: z, height: z, borderRadius: z / 2, borderWidth: 1.5, borderColor: ink }} />;
  if (k === 'optional') return <View style={{ width: z, height: z, borderRadius: z / 2, borderWidth: 1.5, borderColor: onStage ? c.stageInk2 : c.ink3, borderStyle: 'dashed' }} />;
  if (k === 'rest') return <View style={{ width: z, height: 2, borderRadius: 1, backgroundColor: onStage ? c.stageInk2 : c.ink3 }} />;
  return null;
}
function Legend() {
  const { c } = useTheme();
  const Item = ({ k, l }: { k: Kind; l: string }) => <Row gap={4}><Glyph k={k} /><T v="xs" muted>{l}</T></Row>;
  return <Row gap={10}><Item k="done" l="fait" /><Item k="planned" l="prévu" /><Item k="event" l="course" /></Row>;
}

/** Panneau du jour sélectionné : le moment expressif de l'écran. */
function DayPanel({ a, today }: { a: AdaptedPlan; today: string }) {
  const s = useApp(); const { c } = useTheme();
  const shown = a.replaced || a; const isEvent = a.type === 'event' && a.event; const done = doneOn(s, a.date);
  const acts = activitiesOn(s, a.date).filter(x => !x.complementary); const rel = a.date === today ? "Aujourd'hui" : a.date === addDays(today, 1) ? 'Demain' : DAY_NAMES[dow(a.date)];
  const bg = isEvent ? c.stage : c.surface; const fg = isEvent ? c.stageInk : c.ink; const fg2 = isEvent ? c.stageInk2 : c.ink2;
  const n = isEvent ? daysBetween(today, a.date) : 0;
  const Wrap = ({ children }: { children: React.ReactNode }) => isEvent ? <Stage glow style={{ marginBottom: space.s5 }}>{children}</Stage> : <View style={{ backgroundColor: bg, borderRadius: radius.r2, padding: space.s5, marginBottom: space.s5 }}>{children}</View>;
  return (
    <Wrap>
      <Row between>
        <T v="overline" color={isEvent ? c.stageInk2 : c.accent}>{`${rel} · ${isEvent ? 'Compétition' : TYPE_LABEL[shown.type]}${a.optional ? ' · optionnel' : ''}`}</T>
        {isEvent && n >= 0 ? <T v="overline" color={c.stageInk}>{n === 0 ? 'Jour J' : `J-${n}`}</T> : done ? <T v="overline" color={c.ok}>Fait</T> : a.reason ? <T v="overline" color={c.warn}>Adaptée</T> : null}
      </Row>
      <T v="h2" color={fg} style={{ fontSize: 26, lineHeight: 31, marginTop: space.s2 }}>{shown.title}</T>
      {(shown === a ? a.dur : '') || shown.goal ? <T color={fg2} style={{ marginTop: 4 }} numberOfLines={3}>{[shown === a ? a.dur : '', shown.goal].filter(Boolean).join(' · ')}</T> : null}
      {a.note && !a.reason ? <T v="small" color={fg2} style={{ marginTop: space.s2 }}>{a.note}</T> : null}
      {a.reason ? <T v="small" color={fg2} style={{ marginTop: space.s2 }}>{a.reason}</T> : null}
      {shown.type === 'rest' && !a.note && !shown.goal ? <T color={fg2} style={{ marginTop: 4 }}>Récupération. Une marche est bienvenue.</T> : null}
      {done && acts.length ? <T v="small" color={c.ok} style={{ marginTop: space.s2 }}>{`Réalisé : ${acts.map(x => `${x.title}${x.durationMin ? ` · ${Math.round(x.durationMin)} min` : ''}`).join(', ')}`}</T> : null}
      {isEvent && a.event!.result ? <T v="small" color={c.stageInk} style={{ marginTop: space.s2 }}>{`Résultat : ${clock(a.event!.result.time)}`}</T> : null}
      <View style={{ marginTop: space.s4, gap: space.s2 }}>
        {isEvent ? <Button kind="inverse" block label={a.event!.result ? 'Voir le débrief' : 'Préparer la course'} onPress={() => router.push({ pathname: '/race/[id]', params: { id: a.event!.id } })} />
          : shown.type === 'run' || shown.type === 'renfo' ? <Button kind="primary" block label={done && shown.type === 'renfo' ? 'Revoir la séance' : 'Voir la séance'} onPress={() => router.push({ pathname: shown.type === 'run' ? '/run/[date]' : '/renfo/[date]', params: { date: a.date } })} />
          : !done && (shown.type === 'box' || shown.type === 'recup') && a.date <= today ? <Button kind="primary" block label="Marquer comme fait" onPress={() => router.push({ pathname: '/activity', params: { date: a.date, preset: a.replaced ? 'marche' : presetFor(a) } })} />
          : null}
        <Row>
          {shown.type !== 'rest' || done ? <Button small kind="ghost" label="Détail du jour" style={{ paddingHorizontal: 0 }} onPress={() => openDay(a.date)} /> : null}
          {a.hyrox && a.date >= today ? <Button small kind="ghost" label="Pas de HYROX cette semaine" style={{ paddingHorizontal: 0, marginLeft: 'auto' }} onPress={() => update(st => { st.overrides[a.date] = { ...(st.overrides[a.date] || {}), noHyrox: true }; })} /> : null}
          {a.alt && a.date >= today ? <Button small kind="ghost" label="Finalement, HYROX" style={{ paddingHorizontal: 0, marginLeft: 'auto' }} onPress={() => update(st => { delete st.overrides[a.date].noHyrox; })} /> : null}
        </Row>
      </View>
    </Wrap>
  );
}
export const _d = Divider;
