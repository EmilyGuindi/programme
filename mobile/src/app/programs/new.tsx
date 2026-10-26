import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { CompareTable, Issues, PhaseStrip, slotOptions, WeekGrid } from '@/components/program-ui';
import { Sheet } from '@/components/sheet';
import { Button, Choices, Field, Input, Row, Segmented, T, Toggle } from '@/components/ui';
import { addDays, DAYS_SHORT, daysBetween, fmtDay, fmtShort, sportDay } from '@/engine/dates';
import { DateField } from '@/components/date-field';
import { FOCUS_LABEL, programEnd } from '@/engine/generator';
import { nameOf, nextMonday, activate, activationConsequences, analyzeCycle, blocking, compare, findProgram, makeDraft, parseSpec, previousProgram, saveDraft, specOf, suggestedStart, suggestWeeks, validateProgram, weeksBetween } from '@/engine/programs';
import type { ProgramSpec, RunFocus, Slot } from '@/engine/types';
import { haptic } from '@/feedback';
import { update, useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';

const STEPS = ['Bilan', 'Ce qui change', 'Brouillon', 'Vérification', 'Aperçu'];

/** Créer le programme suivant en 5 étapes. Rien n'est enregistré avant « Enregistrer le brouillon », rien n'est activé sans confirmation.
 *  `id` : reprendre un brouillon. `spec` : proposition du coach (JSON), toujours revalidée champ par champ. */
export default function NewProgram() {
  const { id, spec: specParam, weeks: weeksParam, start: startParam, end: endParam } = useLocalSearchParams<{ id?: string; spec?: string; weeks?: string; start?: string; end?: string }>();
  const s = useApp(); const { c } = useTheme(); const today = sportDay();
  const existing = id ? findProgram(s, id) : null; const prev = previousProgram(s, today);
  const analysis = useMemo(() => analyzeCycle(s, prev, today), [prev.id]);
  const [step, setStep] = useState(existing ? 1 : 0);
  const init: ProgramSpec = existing ? specOf(existing) : (() => { try { return parseSpec(specParam ? JSON.parse(specParam) : null, { ...specOf(prev), deloadEvery: specOf(prev).deloadEvery || 4 }); } catch { return { ...specOf(prev), deloadEvery: 4 }; } })();
  const [spec, setSpec] = useState<ProgramSpec>(init);
  // Raccourcis de début : aujourd'hui, lundi prochain ou après le programme en cours (l'actuel s'arrête la veille, son historique est gardé).
  const startOpts = useMemo(() => { const a = suggestedStart(s, today), n = nextMonday(today); return [...new Set([n, addDays(n, 7), a, addDays(a, 7)])].sort().slice(0, 4); }, [today]);
  const [start, setStartRaw] = useState(existing?.start || (startParam && /^\d{4}-\d{2}-\d{2}$/.test(startParam) ? startParam : suggestedStart(s, today)));
  const futureEvents = s.events.filter(e => e.status !== 'annulé' && e.date > today && e.date >= start).sort((a, b) => a.date.localeCompare(b.date));
  const goal = futureEvents.find(e => e.id === spec.goalEventId);
  // Plage précise : date de début et date de fin (incluse). La durée en semaines en découle.
  const [end, setEnd] = useState<string>(existing ? programEnd(existing) : endParam && /^\d{4}-\d{2}-\d{2}$/.test(endParam) && endParam > start ? endParam : addDays(start, (weeksParam ? Math.max(4, Math.min(30, +weeksParam || 12)) : suggestWeeks(start, goal?.date)) * 7 - 1));
  const weeks = weeksBetween(start, end);
  const setWeeks = (n: number) => setEnd(addDays(start, n * 7 - 1));
  /** Changer le début garde la même durée. */
  const setStart = (d: string) => { setEnd(e => addDays(e, daysBetween(start, d))); setStartRaw(d); };
  const [name, setName] = useState(existing?.name || ''); const [editDays, setEditDays] = useState(!!existing);
  const [week, setWeek] = useState(1); const [confirming, setConfirming] = useState(false); const [done, setDone] = useState('');

  const draft = useMemo(() => ({ ...makeDraft({ name, start, end, weeks, spec, basedOn: prev.id }), ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}) }), [name, start, end, weeks, spec, existing?.id]);
  const issues = useMemo(() => validateProgram(s, draft, today), [draft, s.programs, s.program]);
  const set = (patch: Partial<ProgramSpec>) => setSpec(x => ({ ...x, ...patch }));
  const setDay = (i: number, sl: Slot | null) => { if (!sl) return; const d = [...spec.days]; d[i] = sl; set({ days: d }); };

  function save() { update(st => saveDraft(st, draft)); haptic('success'); setDone('Brouillon enregistré. Retrouve-le dans Mes programmes.'); }
  function doActivate() {
    let ok = false; update(st => { saveDraft(st, draft); ok = activate(st, draft.id, today).ok; });
    if (ok) { haptic('success'); setDone(`« ${draft.name} » est programmé à partir du ${fmtShort(draft.start)}.`); } else setConfirming(false);
  }

  if (done) return (
    <Sheet title="C'est noté" sub={draft.name}>
      <View style={{ backgroundColor: c.accentSoft, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s4 }}><T>{done}</T></View>
      <Button kind="primary" block label="Voir mes programmes" onPress={() => router.replace('/programs')} />
    </Sheet>
  );

  const footer = step < 4 ? <Row gap={space.s2}>{step > 0 ? <Button label="Retour" onPress={() => setStep(step - 1)} /> : null}
    <Button kind="primary" style={{ flex: 1 }} disabled={step === 3 && blocking(issues)} label={step === 3 && blocking(issues) ? 'À corriger avant de continuer' : 'Continuer'} onPress={() => { haptic('select'); setStep(step + 1); }} /></Row>
    : confirming ? <View style={{ gap: space.s2 }}><Button kind="primary" block label="Confirmer l'activation" onPress={doActivate} /><Button kind="ghost" block label="Annuler" onPress={() => setConfirming(false)} /></View>
    : <View style={{ gap: space.s2 }}><Button kind="primary" block disabled={blocking(issues)} label="Activer…" onPress={() => setConfirming(true)} /><Row gap={space.s2}><Button label="Retour" onPress={() => setStep(3)} /><Button style={{ flex: 1 }} label="Enregistrer le brouillon" onPress={save} /></Row></View>;

  return (
    <Sheet title={existing ? 'Modifier le brouillon' : 'Prochain programme'} sub={`Étape ${step + 1} sur 5, ${STEPS[step].toLowerCase()}`} footer={footer}>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 5, now: step + 1 }} style={{ flexDirection: 'row', gap: 4, marginBottom: space.s5 }}>{STEPS.map((x, i) => <View key={x} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? c.accent : c.surface2 }} />)}</View>

      {step === 0 ? <>
        <T v="h3" style={{ marginBottom: space.s2 }}>{`Ce que dit « ${nameOf(prev)} »`}</T>
        {analysis.findings.map(f => <Row key={f} gap={space.s2} style={{ alignItems: 'flex-start', marginBottom: 6 }}><T color={c.accent}>•</T><T style={{ flex: 1 }}>{f}</T></Row>)}
        <View style={{ flexDirection: 'row', gap: 4, marginTop: space.s4 }}>
          {analysis.byDay.map(d => <View key={d.dow} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{ height: 48, width: '100%', justifyContent: 'flex-end', backgroundColor: c.surface2, borderRadius: 6, overflow: 'hidden' }}><View style={{ height: `${d.planned ? Math.round((d.done / d.planned) * 100) : 0}%`, backgroundColor: d.dow === analysis.weakDay ? c.warn : c.accent }} /></View>
            <T v="xs" muted>{DAYS_SHORT[d.dow]}</T></View>)}
        </View>
        <T v="xs" muted style={{ marginTop: 6 }}>Séances prévues réalisées, par jour de la semaine.</T>
        <T v="small" muted style={{ marginTop: space.s4 }}>Étape suivante : seulement ce qui change. Le reste reprend ton programme actuel.</T>
      </> : null}

      {step === 1 ? <>
        <Field label="Objectif"><Choices options={(Object.keys(FOCUS_LABEL) as RunFocus[]).map(k => [k, FOCUS_LABEL[k]])} value={spec.focus} onChange={v => v && set({ focus: v })} /></Field>
        <Field label="Compétition objectif" hint="Pour caler l'affûtage. Facultatif.">
          <Choices options={[['', 'Aucune'], ...futureEvents.map(e => [e.id, `${e.name}, ${fmtShort(e.date)}`] as [string, string])]} value={spec.goalEventId || ''} onChange={v => { set({ goalEventId: v || null }); const ev = futureEvents.find(e => e.id === v); if (ev) setWeeks(suggestWeeks(start, ev.date)); }} />
        </Field>
        <Field label="Début" hint="N'importe quel jour, à partir d'aujourd'hui.">
          <DateField label="Début du programme" value={start} min={today} onChange={setStart} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.s2 }}><Choices options={[[today, 'Aujourd\'hui'] as [string, string], ...startOpts.map(d => [d, `Lundi ${fmtShort(d)}`] as [string, string])]} value={start} onChange={v => v && setStart(v)} /></ScrollView>
        </Field>
        <Field label="Fin" hint={goal ? `Conseil : jusqu'à ${goal.name}, plus une semaine de bilan.` : 'Entre 3 et 30 semaines après le début.'}>
          <DateField label="Fin du programme" value={end} min={addDays(start, 20)} max={addDays(start, 30 * 7 - 1)} onChange={setEnd} />
          <Row gap={space.s3} style={{ marginTop: space.s2, alignItems: 'center' }}><Button small label="− 1 sem." onPress={() => setWeeks(Math.max(3, weeks - 1))} /><T v="label" style={{ flex: 1, textAlign: 'center' }}>{`${daysBetween(start, end) + 1} jours, ${weeks} sem.`}</T><Button small label="+ 1 sem." onPress={() => setWeeks(Math.min(30, weeks + 1))} /></Row>
          <T v="xs" muted style={{ marginTop: 6 }}>{`Du ${fmtDay(start)} au ${fmtDay(end)}.`}</T>
        </Field>
        <Field label="Semaine type">
          <Row between style={{ marginBottom: space.s2 }}><T v="small" muted style={{ flex: 1 }}>{editDays ? 'Choisis le contenu de chaque jour.' : 'Identique à ton programme actuel.'}</T><Toggle label="Changer la semaine type" value={editDays} onChange={setEditDays} /></Row>
          {editDays ? spec.days.map((d, i) => <View key={i} style={{ marginBottom: space.s3 }}><T v="label" style={{ marginBottom: 4 }}>{DAYS_SHORT[i]}</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}><Choices options={slotOptions} value={d} onChange={v => setDay(i, v)} /></ScrollView></View>) : null}
        </Field>
        <Field label="Semaine allégée"><Segmented options={[['0', 'Aucune'], ['3', 'Toutes les 3'], ['4', 'Toutes les 4'], ['5', 'Toutes les 5']]} value={String(spec.deloadEvery)} onChange={v => set({ deloadEvery: +v })} /></Field>
        <Field label="Tests chronométrés"><Row between><T v="small" muted style={{ flex: 1 }}>Un 5 km de repère au début, un test en fin de programme.</T><Toggle label="Tests chronométrés" value={spec.tests !== false} onChange={v => set({ tests: v })} /></Row></Field>
        <Field label="Contraintes" hint="Gardées comme note : voyages, gêne, horaires…"><Input multiline style={{ minHeight: 72, paddingTop: 12, textAlignVertical: 'top' }} defaultValue={spec.constraints || s.user.constraints || ''} onChangeText={t => set({ constraints: t.slice(0, 400) })} /></Field>
        <Field label="Nom"><Input defaultValue={name} placeholder={`Programme du ${fmtShort(start)}`} onChangeText={setName} /></Field>
      </> : null}

      {step === 2 ? <>
        <T v="h3" style={{ marginBottom: 4 }}>{draft.name}</T>
        <T v="small" muted style={{ marginBottom: space.s4 }}>{`${FOCUS_LABEL[spec.focus]}. ${weeks} semaines, du ${fmtShort(start)} au ${fmtShort(end)}.`}</T>
        <PhaseStrip p={draft} />
        <Row between style={{ marginBottom: space.s2 }}><T v="label">{`Semaine ${week}`}</T><Row gap={space.s2}><Button small label="‹" onPress={() => setWeek(Math.max(1, week - 1))} /><Button small label="›" onPress={() => setWeek(Math.min(weeks, week + 1))} /></Row></Row>
        <WeekGrid p={draft} week={week} />
      </> : null}

      {step === 3 ? <>
        <T v="small" muted style={{ marginBottom: space.s3 }}>Les règles de sécurité BYYND s'appliquent à tout programme, qu'il vienne de toi ou du coach.</T>
        <Issues issues={issues} />
      </> : null}

      {step === 4 ? <>
        <T v="h3" style={{ marginBottom: space.s3 }}>{`Comparé à « ${nameOf(prev)} »`}</T>
        <CompareTable rows={compare(prev, draft)} a={nameOf(prev)} b={draft.name} />
        {confirming ? <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4 }}>
          <T v="label" style={{ marginBottom: space.s2 }}>Ce que l'activation change</T>
          {activationConsequences(s, draft, today).map(x => <Row key={x} gap={space.s2} style={{ alignItems: 'flex-start', marginBottom: 4 }}><T color={c.accent}>•</T><T v="small" style={{ flex: 1 }}>{x}</T></Row>)}
        </View> : <T v="small" muted>Enregistre-le en brouillon pour y revenir, ou active-le : tu verras d'abord ce que cela change.</T>}
      </> : null}
    </Sheet>
  );
}
