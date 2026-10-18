import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { CompareTable, Issues, PhaseStrip, WeekGrid } from '@/components/program-ui';
import { Sheet } from '@/components/sheet';
import { Button, Chip, KV, Row, T } from '@/components/ui';
import { weekOf } from '@/engine/coach';
import { addDays, fmtShort, mmss, sportDay } from '@/engine/dates';
import { FOCUS_LABEL, programEnd } from '@/engine/generator';
import { nameOf, activate, activationConsequences, allPrograms, archive, blocking, compare, deleteDraft, findProgram, specOf, STATUS_LABEL, statusOf, summarize, validateProgram } from '@/engine/programs';
import { haptic } from '@/feedback';
import { update, useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';

/** Aperçu natif d'un programme : phases, semaine type, vérification, comparaison, bilan. Activer demande une confirmation. */
export default function ProgramDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(); const s = useApp(); const { c } = useTheme(); const today = sportDay();
  const p = findProgram(s, id); const [week, setWeek] = useState(1); const [cmp, setCmp] = useState<string | null>(null); const [confirming, setConfirming] = useState(false);
  if (!p) return <Sheet title="Programme introuvable"><Button block label="Retour" onPress={() => router.back()} /></Sheet>;
  const st = statusOf(p, today); const issues = st === 'draft' ? validateProgram(s, p, today) : [];
  const others = allPrograms(s).filter(x => x.id !== p.id && x.status !== 'archived');
  const other = cmp ? findProgram(s, cmp) : null;
  const sum = st === 'done' || st === 'active' ? p.summary || summarize(s, p, today) : null;
  const cur = st === 'active' ? Math.min(p.weeks, Math.max(1, weekOf({ ...s, program: p }, today))) : null;

  const footer = st === 'draft' ? (confirming
    ? <View style={{ gap: space.s2 }}><Button kind="primary" block label="Confirmer l'activation" onPress={() => { let ok = false; update(x => { ok = activate(x, p.id, today).ok; }); if (ok) { haptic('success'); router.back(); } }} /><Button kind="ghost" block label="Annuler" onPress={() => setConfirming(false)} /></View>
    : <View style={{ gap: space.s2 }}><Button kind="primary" block disabled={blocking(issues)} label={blocking(issues) ? 'À corriger avant d\'activer' : 'Activer…'} onPress={() => setConfirming(true)} />
      <Row gap={space.s2}><Button style={{ flex: 1 }} label="Modifier" onPress={() => router.push({ pathname: '/programs/new', params: { id: p.id } })} />
        <Button kind="danger" label="Supprimer" onPress={() => Alert.alert('Supprimer ce brouillon ?', 'Il n\'a jamais été activé : rien d\'autre ne change.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: () => { update(x => deleteDraft(x, p.id)); router.back(); } }])} /></Row></View>)
    : st === 'done' ? <Button block label="Archiver" onPress={() => { update(x => archive(x, p.id)); router.back(); }} /> : undefined;

  return (
    <Sheet title={nameOf(p)} sub={STATUS_LABEL[st]} footer={footer}>
      <Row gap={space.s2} style={{ marginBottom: space.s3, flexWrap: 'wrap' }}><Chip tone={st === 'active' ? 'accent' : 'neutral'} label={STATUS_LABEL[st]} /><Chip label={p.template === 'custom' ? FOCUS_LABEL[specOf(p).focus] : 'Cycle d\'origine'} /></Row>
      <T muted style={{ marginBottom: space.s4 }}>{`${p.weeks} semaines, du ${fmtShort(p.start)} au ${fmtShort(programEnd(p))}${p.end ? ' (terminé plus tôt)' : ''}.${cur ? ` Semaine ${cur} en cours.` : ''}`}</T>
      {specOf(p).constraints ? <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s3, marginBottom: space.s4 }}><T v="xs" muted>Contraintes notées</T><T v="small">{specOf(p).constraints!}</T></View> : null}

      {sum ? <View style={{ marginBottom: space.s4 }}>
        <T v="label" style={{ marginBottom: 4 }}>{st === 'done' ? 'Bilan' : 'Jusqu\'ici'}</T>
        <KV k="Séances prévues réalisées" v={`${sum.done} sur ${sum.planned}`} />
        <KV k="Course" v={`${sum.runs} sorties, ${String(sum.km).replace('.', ',')} km`} />
        {sum.pace.first && sum.pace.last ? <KV k="Allure facile" v={`${mmss(sum.pace.first)} → ${mmss(sum.pace.last)} /km`} /> : null}
        <KV k="Records battus" v={String(sum.records)} />
        {sum.weightDelta != null ? <KV k="Poids" v={`${sum.weightDelta > 0 ? '+' : ''}${String(sum.weightDelta).replace('.', ',')} kg`} /> : null}
      </View> : null}

      <T v="label" style={{ marginBottom: space.s2 }}>Phases</T>
      <PhaseStrip p={p} />
      {p.template === 'custom' ? <>
        <Row between style={{ marginBottom: space.s2 }}><T v="label">{`Semaine ${week}, du ${fmtShort(addDays(p.start, (week - 1) * 7))}`}</T><Row gap={space.s2}><Button small label="‹" onPress={() => setWeek(Math.max(1, week - 1))} /><Button small label="›" onPress={() => setWeek(Math.min(p.weeks, week + 1))} /></Row></Row>
        <WeekGrid p={p} week={week} />
      </> : <T v="small" muted style={{ marginBottom: space.s4 }}>Le cycle d'origine suit son calendrier détaillé, visible dans l'onglet Programme.</T>}

      {st === 'draft' ? <><T v="label" style={{ marginBottom: space.s2 }}>Vérification</T><Issues issues={issues} /></> : null}
      {confirming ? <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s4 }}>
        <T v="label" style={{ marginBottom: space.s2 }}>Ce que l'activation change</T>
        {activationConsequences(s, p, today).map(x => <Row key={x} gap={space.s2} style={{ alignItems: 'flex-start', marginBottom: 4 }}><T color={c.accent}>•</T><T v="small" style={{ flex: 1 }}>{x}</T></Row>)}
      </View> : null}

      {others.length ? <>
        <T v="label" style={{ marginBottom: space.s2 }}>Comparer avec</T>
        <Row gap={space.s2} style={{ flexWrap: 'wrap', marginBottom: space.s3 }}>{others.map(o => <Button key={o.id} small kind={cmp === o.id ? 'primary' : 'secondary'} label={nameOf(o)} onPress={() => setCmp(cmp === o.id ? null : o.id)} />)}</Row>
        {other ? <CompareTable rows={compare(other, p)} a={nameOf(other)} b={nameOf(p)} /> : null}
      </> : null}
    </Sheet>
  );
}
