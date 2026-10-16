import { useLocalSearchParams, router } from 'expo-router';
import { View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Bullets, Disclosure } from '@/components/guide';
import { Sheet } from '@/components/sheet';
import { EX_GUIDE } from '@/engine/guides';
import { Button, Card, Coach, Gap, Input, Row, Segmented, T, Tick } from '@/components/ui';
import { adapted, bestKg, recovery, strengthBlocks, suggestKg } from '@/engine/coach';
import { fmtDay } from '@/engine/dates';
import { LEGS, WARMUP } from '@/engine/library';
import type { ExerciseLog } from '@/engine/types';
import { getState, update, useApp } from '@/store/store';
import { space, useTheme } from '@/theme/tokens';
import { useState } from 'react';
import { Pressable } from 'react-native';

export default function RenfoScreen() {
  const { date } = useLocalSearchParams<{ date: string }>(); const s = useApp(); const { c } = useTheme();
  const a = adapted(s, date); const lv = s.overrides[date]?.level || a.level; const log = s.strength[date] || { ex: {} };
  const mode: 'n' | 'r' | 'x' = lv === 'rouge' ? 'x' : lv === 'orange' ? 'r' : 'n';
  const blocks = strengthBlocks(s, date, mode === 'r'); const shoulder = recovery(s, date).shoulder;
  const [open, setOpen] = useState<string | null>(null);
  const ex = (id: string): ExerciseLog => log.ex?.[id] || { kg: [], reps: [], done: [] };
  const setEx = (id: string, fn: (e: ExerciseLog) => void) => update(st => { const l = (st.strength[date] = st.strength[date] || { ex: {} }); const e = (l.ex[id] = l.ex[id] || { kg: [], reps: [], done: [] }); fn(e); });
  return (
    <Sheet title={a.title} sub={`${fmtDay(date)} · optionnel · ${a.dur}`}>
      {a.reason ? <Coach>{a.reason}</Coach> : null}
      <T v="label" style={{ marginBottom: 6 }}>Aujourd'hui je la fais</T>
      <Segmented options={[['n', 'Normale'], ['r', 'Réduite'], ['x', 'Je passe']]} value={mode} onChange={v => update(st => { st.overrides[date] = { ...(st.overrides[date] || {}), level: v === 'x' ? 'rouge' : v === 'r' ? 'orange' : 'vert' }; })} />
      <Gap />
      {mode === 'x' ? <Card><T v="h3">Séance supprimée</T><T muted style={{ marginTop: 6 }}>Repos ou marche. Pas de rattrapage : lundi reste un jour de repos.</T></Card> : <>
        <Disclosure title="Comment lire la séance" sub="Supersets, RIR, repos, charges" open={!Object.keys(log.ex || {}).length}>
          <Bullets items={[
            'Superset : tu enchaînes les deux exercices d\'un bloc (A1 puis A2) sans pause, puis tu te reposes, puis tu recommences. Ça gagne du temps sans fatiguer les mêmes muscles.',
            'Séries × répétitions : « 3 × 8–10 » veut dire 3 séries de 8 à 10 répétitions.',
            'RIR (répétitions en réserve) : combien de répétitions tu pourrais encore faire à la fin de la série. RIR 2 = tu t\'arrêtes en pouvant en faire 2 de plus, avec une technique propre.',
            'Choisir la charge : prends un poids qui te mène au RIR indiqué dans la fourchette de répétitions. Trop facile, monte un peu à la série suivante ; trop dur, baisse.',
            'Charge suggérée : calculée à partir de tes séances précédentes. Si tu as fait le haut de la fourchette partout la dernière fois, l\'app te propose un peu plus.',
            'Note la charge et les répétitions de chaque série, puis coche : c\'est ce qui permet de progresser.',
          ]} />
        </Disclosure>
        <Card><T v="h3">Échauffement · 6–8 min</T>{WARMUP.map((w, i) => <Row key={i} style={{ paddingVertical: 6 }}><Tick sizePx={28} on={!!log.warm?.[i]} label={w} onPress={() => update(st => { const l = (st.strength[date] = st.strength[date] || { ex: {} }); l.warm = { ...(l.warm || {}), [i]: !l.warm?.[i] }; })} /><T style={{ flex: 1 }}>{w}</T></Row>)}</Card>
        {blocks.map((b, bi) => (
          <View key={b.title}>
            <T v="small" muted style={{ marginTop: space.s3, marginBottom: 6, fontWeight: '600' }}>{b.title}</T>
            {b.leg ? <View style={{ marginBottom: 8 }}><Segmented options={LEGS} value={b.legSel!} onChange={v => update(st => { st.strength[date] = { ...(st.strength[date] || { ex: {} }), leg: v }; })} /></View> : null}
            {b.items.map((e, ii) => {
              const x = ex(e.id); const full = x.done.slice(0, e.nSets).filter(Boolean).length >= e.nSets; const sug = suggestKg(s, e, date); const last = bestKg(s, e.id, date);
              return (
                <Card key={e.id} style={full ? { borderColor: c.ok } : undefined}>
                  <T v="h3">{`${b.items.length > 1 ? 'ABCDEF'[bi] + (ii + 1) + ' · ' : ''}${e.name}`}</T>
                  <Row gap={6} style={{ flexWrap: 'wrap', marginVertical: 8 }}>
                    <Chip hot>{`${e.nSets} × ${e.repsTxt}`}</Chip><Chip>{`RIR ${e.rirTxt}`}</Chip><Chip>{`Repos ${b.items.length > 1 ? 'en fin de tour' : e.rest}`}</Chip>{sug ? <Chip>{`Suggéré ${String(sug).replace('.', ',')} kg`}</Chip> : null}
                  </Row>
                  {Array.from({ length: e.nSets }, (_, j) => (
                    <Row key={j} gap={8} style={{ marginBottom: 6 }}>
                      <T v="small" muted style={{ width: 18 }}>{j + 1}</T>
                      <Input style={{ flex: 1 }} keyboardType="decimal-pad" defaultValue={x.kg[j] ?? ''} placeholder={sug ? String(sug) : last ? String(last) : 'kg'} onChangeText={t => setEx(e.id, l => { l.kg[j] = t.replace(',', '.'); })} />
                      <Input style={{ flex: 1 }} keyboardType="number-pad" defaultValue={x.reps[j] ?? ''} placeholder="reps" onChangeText={t => setEx(e.id, l => { l.reps[j] = t; })} />
                      <Tick sizePx={44} on={!!x.done[j]} label={`Série ${j + 1} faite`} onPress={() => setEx(e.id, l => { l.done[j] = !l.done[j]; })} />
                    </Row>))}
                  <Pressable onPress={() => setOpen(open === e.id ? null : e.id)}><T v="small" color={c.accent} style={{ marginTop: 4 }}>{open === e.id ? 'Masquer le mode d\'emploi' : 'Mode d\'emploi complet'}</T></Pressable>
                  {shoulder && e.shoulder && open !== e.id ? <T v="small" color={c.stop} style={{ marginTop: 6 }}><T v="small" style={{ fontWeight: '600' }}>Épaule : </T>{e.shoulder}</T> : null}
                  {open === e.id ? (() => { const g = EX_GUIDE[e.id]; return (
                    <View style={{ gap: 10, marginTop: 8 }}>
                      {g ? <>
                        <View><T v="label">Installation</T><Bullets items={g.setup} numbered /></View>
                        <View><T v="label">Exécution</T><Bullets items={g.exec} numbered /></View>
                        <T v="small"><T v="small" style={{ fontWeight: '600' }}>Respiration : </T>{g.breath}</T>
                        <T v="small"><T v="small" style={{ fontWeight: '600' }}>Ce que tu dois sentir : </T>{g.feel}</T>
                        <View><T v="label">Erreurs fréquentes</T><Bullets items={g.mistakes} /></View>
                        <T v="small"><T v="small" style={{ fontWeight: '600' }}>Plus facile : </T>{g.easier}</T>
                        <T v="small"><T v="small" style={{ fontWeight: '600' }}>Plus dur : </T>{g.harder}</T>
                      </> : <T v="small">{e.tech}</T>}
                      <T v="small"><T v="small" style={{ fontWeight: '600' }}>Sans le matériel : </T>{e.alt}</T>
                      {e.shoulder ? <T v="small" color={shoulder ? c.stop : undefined}><T v="small" style={{ fontWeight: '600' }}>Si l'épaule fait mal : </T>{e.shoulder}</T> : null}
                      {g ? <Button small label="Voir une démonstration vidéo" onPress={() => WebBrowser.openBrowserAsync(`https://www.youtube.com/results?search_query=${encodeURIComponent(g.search)}`)} /> : null}
                    </View>); })() : null}
                </Card>);
            })}
          </View>))}
        <T v="xs" muted>Charge suggérée : ta dernière charge, +1 kg (+2,5 kg sur hip thrust et RDL) si tu as atteint le haut de la fourchette sur toutes les séries.</T>
        <Gap />
        <Button kind="primary" block label="Terminer la séance" onPress={() => { update(st => { if (!st.activities.some(x => x.date === date && x.type === 'renfo')) st.activities.push({ id: 'renfo-' + date, date, type: 'renfo', title: 'Renforcement', source: 'manuel', matched: date, complementary: false }); }); const a = getState().activities.find(x => x.date === date && x.type === 'renfo'); if (a && !getState().closures?.[a.id]) router.replace({ pathname: '/done/[id]', params: { id: a.id } }); else router.back(); }} />
      </>}
    </Sheet>
  );
}
function Chip({ children, hot }: { children: string; hot?: boolean }) {
  const { c } = useTheme();
  return <View style={{ backgroundColor: hot ? c.accentSoft : c.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}><T v="small" color={hot ? c.accent : undefined} style={{ fontWeight: '600' }}>{children}</T></View>;
}
