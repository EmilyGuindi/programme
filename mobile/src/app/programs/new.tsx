import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { CompareTable, Issues, PhaseStrip, slotOptions, WeekGrid } from '@/components/program-ui';
import { Sheet } from '@/components/sheet';
import { Button, Choices, Field, Input, Row, Segmented, T, Toggle } from '@/components/ui';
import { addDays, DAYS_SHORT, fmtShort, sportDay } from '@/engine/dates';
import { FOCUS_LABEL } from '@/engine/generator';
import { nameOf, activate, activationConsequences, analyzeCycle, blocking, compare, findProgram, makeDraft, parseSpec, previousProgram, saveDraft, specOf, suggestedStart, suggestWeeks, validateProgram } from '@/engine/programs';
import type { ProgramSpec, RunFocus, Slot } from '@/engine/types';
import { haptic } from '@/feedback';
import { update, useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';

const STEPS = ['Bilan', 'Ce qui change', 'Brouillon', 'Vérification', 'Aperçu'];

/** Créer le programme suivant en 5 étapes. Rien n'est enregistré avant « Enregistrer le brouillon », rien n'est activé sans confirmation.
 *  `id` : reprendre un brouillon. `spec` : proposition du coach (JSON), toujours revalidée champ par champ. */
export default function NewProgram() {
  const { id, spec: specParam, weeks: weeksParam } = useLocalSearchParams<{ id?: string; spec?: string; weeks?: string }>();
  const s = useApp(); const { c } = useTheme(); const today = sportDay();
  const existing = id ? findProgram(s, id) : null; const prev = previousProgram(s, today);
  const analysis = useMemo(() => analyzeCycle(s, prev, today), [prev.id]);
  const [step, setStep] = useState(existing ? 1 : 0);
  const init: ProgramSpec = existing ? specOf(existing) : (() => { try { return parseSpec(specParam ? JSON.parse(specParam) : null, { ...specOf(prev), deloadEvery: specOf(prev).deloadEvery || 4 }); } catch { return { ...specOf(prev), deloadEvery: 4 }; } })();
  const [spec, setSpec] = useState<ProgramSpec>(init);
  const futureEvents = s.events.filter(e => e.status !== 'annulé' && e.date > today && e.date >= start).sort((a, b) => a.date.localeCompare(b.date));
  const [start, setStart] = useState(existing?.start || suggestedStart(s, today));
  const startOpts = useMemo(() => { const a = suggestedStart(s, today); return [a, addDays(a, 7), addDays(a, 14)]; }, [today]);
  const goal = futureEvents.find(e => e.id === spec.goalEventId);
  const [weeks, setWeeks] = useState(existing?.weeks || (weeksParam ? Math.max(4, Math.min(30, +weeksParam || 12)) : suggestWeeks(start, goal?.date)));
  const [name, setName] = useState(existing?.name || ''); const [editDays, setEditDays] = useState(!!existing);
  const [week, setWeek] = useState(1); const [confirming, setConfirming] = useState(false); const [done, setDone] = useState('');

  const draft = useMemo(() => ({ ...makeDraft({ name, start, weeks, spec, basedOn: prev.id }), ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}) }), [name, start, weeks, spec, existing?.id]);
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
        <Field label="Début"><Choices options={startOpts.map(d => [d, `Lundi ${fmtShort(d)}`] as [string, string])} value={start} onChange={v => v && setStart(v)} /></Field>
        <Field label="Durée" hint={goal ? `Jusqu'à ${goal.name}, plus une semaine de bilan.` : 'Entre 4 et 30 semaines.'}>
          <Row gap={space.s3}><Button small label="−" onPress={() => setWeeks(Math.max(4, weeks - 1))} /><T v="num" style={{ minWidth: 110, textAlign: 'center', fontSize: 20 }}>{`${weeks} semaines`}</T><Button small label="+" onPress={() => setWeeks(Math.min(30, weeks + 1))} /></Row>
          <T v="xs" muted style={{ marginTop: 6 }}>{`Du ${fmtShort(start)} au ${fmtShort(addDays(start, weeks * 7 - 1))}.`}</T>
        </Field>
        <Field label="Semaine type">
          <Row between style={{ marginBottom: space.s2 }}><T v="small" muted style={{ flex: 1 }}>{editDays ? 'Choisis le contenu de chaque jour.' : 'Identique à ton programme actuel.'}</T><Toggle label="Changer la semaine type" value={editDays} onChange={setEditDays} /></Row>
          {editDays ? spec.days.map((d, i) => <View key={i} style={{ marginBottom: space.s3 }}><T v="label" style={{ marginBottom: 4 }}>{DAYS_SHORT[i]}</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}><Choices options={slotOptions} value={d} onChange={v => setDay(i, v)} /></ScrollView></View>) : null}
        </Field>
        <Field label="Semaine allégée"><Segmented options={[['0', 'Aucune'], ['3', 'Toutes les 3'], ['4', 'Toutes les 4'], ['5', 'Toutes les 5']]} value={String(spec.deloadEvery)} onChange={v => set({ deloadEvery: +v })} /></Field>
        <Field label="Tests chronométrés"><Row between><T v="small" muted style={{ flex: 1 }}>Un 5 km de repère au début, un test en fin de programme.</T><Toggle label="Tests chronométrés" value={spec.tests !== false} onChange={v => set({ tests: v })} /></Row></Field>
        <Field label="Contraintes" hint="Gardées comme note : voyages, gêne, horaires…"><Input multiline style={{ minHeight: 72, paddingTop: 12, textAlignVertical: 'top' }} defaultValue={spec.constraints || ''} onChangeText={t => set({ constraints: t.slice(0, 400) })} /></Field>
        <Field label="Nom"><Input defaultValue={name} placeholder={`Programme du ${fmtShort(start)}`} onChangeText={setName} /></Field>
      </> : null}

      {step === 2 ? <>
        <T v="h3" style={{ marginBottom: 4 }}>{draft.name}</T>
        <T v="small" muted style={{ marginBottom: space.s4 }}>{`${FOCUS_LABEL[spec.focus]}. ${weeks} semaines, du ${fmtShort(start)} au ${fmtShort(addDays(start, weeks * 7 - 1))}.`}</T>
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
