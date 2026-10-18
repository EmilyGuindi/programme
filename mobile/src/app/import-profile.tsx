import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Input, Row, T } from '@/components/ui';
import { applyChanges, diffProfile, parseProfile, PROMPT_CHATGPT, type Change } from '@/engine/profile-import';
import { haptic } from '@/feedback';
import { getState, update, useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';

const KIND: Record<Change['kind'], string> = { add: 'Ajout', update: 'Modification', conflict: 'Contradiction', skip: 'Gardé tel quel' };

/** Importer mon profil sportif : coller ou choisir un fichier → valider → voir les différences → corriger → confirmer. */
export default function ImportProfile() {
  const s = useApp(); const { c } = useTheme();
  const [text, setText] = useState(''); const [err, setErr] = useState(''); const [warn, setWarn] = useState<string[]>([]);
  const [changes, setChanges] = useState<Change[] | null>(null); const [sel, setSel] = useState<Set<string>>(new Set()); const [done, setDone] = useState('');

  function analyse(t = text) {
    setErr(''); const r = parseProfile(t); if ('error' in r) { setErr(r.error); setChanges(null); return; }
    const ch = diffProfile(s, r.profile); setWarn(r.warnings); setChanges(ch);
    setSel(new Set(ch.filter(x => x.kind === 'add').map(x => x.id))); // contradictions et modifications : à cocher explicitement
  }
  async function pick() {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/markdown', 'text/plain', '*/*'], copyToCacheDirectory: true }); if (r.canceled) return;
    try { const t = await new File(r.assets[0].uri).text(); setText(t); analyse(t); } catch { setErr('Fichier illisible.'); }
  }
  async function confirm() {
    if (!changes) return;
    try { await AsyncStorage.setItem('byynd-backup-before-import', JSON.stringify({ at: Date.now(), state: getState() })); } catch {}
    update(st => applyChanges(st, changes, sel)); haptic('success');
    setDone(`${sel.size} élément${sel.size > 1 ? 's' : ''} importé${sel.size > 1 ? 's' : ''}. Une copie de tes données d'avant l'import est gardée sur ce téléphone.`);
  }
  const toggle = (id: string) => setSel(x => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (done) return <Sheet title="Profil importé"><View style={{ backgroundColor: c.accentSoft, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s4 }}><T>{done}</T></View><Button kind="primary" block label="Terminé" onPress={() => router.back()} /></Sheet>;

  return (
    <Sheet title="Importer mon profil sportif" sub="JSON, Markdown ou texte"
      footer={changes ? <Row gap={space.s2}><Button label="Annuler" onPress={() => setChanges(null)} /><Button kind="primary" style={{ flex: 1 }} disabled={!sel.size} label={sel.size ? `Importer ${sel.size} élément${sel.size > 1 ? 's' : ''}` : 'Rien de coché'} onPress={confirm} /></Row>
        : <Button kind="primary" block disabled={!text.trim()} label="Analyser" onPress={() => analyse()} />}>
      {!changes ? <>
        <T v="small" muted style={{ marginBottom: space.s3 }}>Tes données actuelles et tes activités Strava ne sont jamais écrasées : tu verras chaque différence avant de confirmer.</T>
        <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s4 }}>
          <T v="label">Depuis ChatGPT</T>
          <T v="small" muted style={{ marginTop: 4 }}>Partage ce prompt vers ChatGPT, puis colle sa réponse ici.</T>
          <Button small style={{ alignSelf: 'flex-start', marginTop: space.s3 }} label="Partager le prompt" onPress={() => Share.share({ message: PROMPT_CHATGPT })} />
        </View>
        <Input multiline value={text} onChangeText={setText} placeholder={'{ "schema": "byynd-profile/1", … }\nou\nObjectif course : 10 km en 55 min'} style={{ minHeight: 180, paddingTop: 12, textAlignVertical: 'top', fontSize: 14 }} accessibilityLabel="Profil à importer" />
        <Button small kind="ghost" style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: space.s2 }} label="Choisir un fichier" onPress={pick} />
        {err ? <T v="small" color={c.stop} style={{ marginTop: space.s2 }}>{err}</T> : null}
      </> : <>
        {warn.map(w => <T key={w} v="small" color={c.warn} style={{ marginBottom: 4 }}>{w}</T>)}
        {!changes.length ? <T>Rien de nouveau : ton profil est déjà à jour.</T> : null}
        {changes.map(ch => { const on = sel.has(ch.id); const skip = ch.kind === 'skip';
          return <Pressable key={ch.id} disabled={skip} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: skip }} onPress={() => toggle(ch.id)}
            style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s2, borderWidth: ch.kind === 'conflict' ? 1 : 0, borderColor: c.warn, opacity: skip ? 0.7 : 1 }}>
            <Row gap={space.s3} style={{ alignItems: 'flex-start' }}>
              {!skip ? <View style={{ width: 22, height: 22, borderRadius: 6, marginTop: 2, borderWidth: on ? 0 : 1.5, borderColor: c.stroke, backgroundColor: on ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{on ? <T v="xs" color={c.accentInk} style={{ fontWeight: '700' }}>✓</T> : null}</View> : <View style={{ width: 22 }} />}
              <View style={{ flex: 1 }}>
                <T v="xs" color={ch.kind === 'conflict' ? c.warn : c.ink2} style={{ fontWeight: '700' }}>{KIND[ch.kind]}</T>
                <T v="label">{ch.label}</T>
                <T v="small" muted>{`Actuel : ${ch.current}`}</T><T v="small">{`Importé : ${ch.incoming}`}</T>
                {ch.reason ? <T v="xs" muted style={{ marginTop: 4 }}>{ch.reason}</T> : null}
              </View>
            </Row>
          </Pressable>; })}
      </>}
    </Sheet>
  );
}
