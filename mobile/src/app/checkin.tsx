import { router, useLocalSearchParams } from 'expo-router';
import { Sheet } from '@/components/sheet';
import { Button, Card, Choices, Field, Gap, Pill, T } from '@/components/ui';
import { coachLine, recovery } from '@/engine/coach';
import { fmtLong, sportDay } from '@/engine/dates';
import type { CheckIn } from '@/engine/types';
import { update, useApp } from '@/store/store';

const scale5: [number, string][] = [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']];

export default function CheckInScreen() {
  const { then } = useLocalSearchParams<{ then?: string }>();
  const s = useApp(); const d = sportDay(); const c: CheckIn = s.checkins[d] || {};
  const set = <K extends keyof CheckIn>(k: K, v: CheckIn[K]) => update(st => {
    const ci = (st.checkins[d] = st.checkins[d] || {}); ci[k] = v; ci.at = Date.now();
    if (k === 'soreness' && v !== 'fortes') ci.soreZone = null;
    if (k === 'pain' && v !== 'oui') { ci.painZone = null; ci.painLevel = null; }
  });
  const complete = !!(c.sleep && c.energy && c.soreness && c.pain && c.motivation);
  const r = recovery(s, d);
  return (
    <Sheet title="Check-in du matin" sub={fmtLong(d)}>
      <Field label="Comment as-tu dormi ?"><Choices options={[['mal', 'Mal'], ['moyen', 'Moyen'], ['bien', 'Bien'], ['tres', 'Très bien']]} value={c.sleep} onChange={v => set('sleep', v)} /></Field>
      <Field label="Ton énergie ?" hint="de 1, vide, à 5, pleine"><Choices options={scale5} value={c.energy} onChange={v => set('energy', v)} /></Field>
      <Field label="Des courbatures ?"><Choices options={[['non', 'Non'], ['peu', 'Un peu'], ['fortes', 'Fortes']]} value={c.soreness} onChange={v => set('soreness', v)} /></Field>
      {c.soreness === 'fortes' ? <Field label="Où ?"><Choices options={[['jambes', 'Jambes'], ['fessiers', 'Fessiers'], ['dos', 'Dos'], ['épaules', 'Épaules'], ['partout', 'Partout']]} value={c.soreZone} onChange={v => set('soreZone', v)} /></Field> : null}
      <Field label="Une douleur ?"><Choices options={[['non', 'Non'], ['oui', 'Oui']]} value={c.pain} onChange={v => set('pain', v)} /></Field>
      {c.pain === 'oui' ? <>
        <Field label="Zone"><Choices options={[['épaule', 'Épaule'], ['genou', 'Genou'], ['dos', 'Dos'], ['cheville', 'Cheville'], ['hanche', 'Hanche'], ['autre', 'Autre']]} value={c.painZone} onChange={v => set('painZone', v)} /></Field>
        <Field label="Intensité" hint="de 0 à 10"><Choices cols={11} options={Array.from({ length: 11 }, (_, i) => [i, String(i)] as [number, string])} value={c.painLevel} onChange={v => set('painLevel', v)} /></Field>
      </> : null}
      <Field label="Motivation ?" hint="de 1 à 5"><Choices options={scale5} value={c.motivation} onChange={v => set('motivation', v)} /></Field>
      {s.user.prefs.cycleOptIn ? <Field label="Règles aujourd'hui ?"><Choices options={[['non', 'Non'], ['oui', 'Oui']]} value={c.period} onChange={v => set('period', v)} /></Field> : null}
      <Card>
        <Pill level={complete ? r.level : 'inconnu'} /><Gap h={8} />
        <T v="small">{complete ? `${r.reasons[0]} ${coachLine(s, d)}` : 'Réponds aux 5 questions pour obtenir ton état du jour.'}</T>
      </Card>
      {then === 'measure' ? <Button kind="primary" block disabled={!complete} label="Continuer : ma pesée" onPress={() => router.replace('/measure')} /> : <Button kind="primary" block disabled={!complete} label="Voir ma journée" onPress={() => router.back()} />}
    </Sheet>
  );
}
