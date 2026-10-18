import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { ask, appendMessages, decide, ensureMemory, memory, providerFor, threadById } from '@/ai/studio';
import { SUGGESTIONS } from '@/ai/local';
import { setupRemoteCoach } from '@/ai/remote';
import { useDictation } from '@/ai/voice';
import { attachmentLabel, MAX_ATTACHMENTS, pickFile, pickPhoto, type Attachment } from '@/ai/attachments';
import { remoteDetail } from '@/ai/claude';
import { CoachCardView } from '@/components/coach-cards';
import { CoachGuided } from '@/components/coach-guided';
import { Icon } from '@/components/icons';
import { Sheet } from '@/components/sheet';
import { Button, Input, Row, T } from '@/components/ui';
import { sportDay } from '@/engine/dates';
import { SCOPE_LABEL } from '@/engine/tools';
import type { CoachMsg } from '@/engine/types';
import { haptic } from '@/feedback';
import { getState, update, useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';

const CONTEXT_SUGGESTIONS: Record<string, string[]> = {
  today: ['Je suis fatiguée aujourd\'hui, adapte ma séance', 'Mets ma séance de demain à un autre jour', 'Ma semaine'],
  program: ['La semaine prochaine, mets mon running lundi plutôt que mercredi', 'Construis mon programme après celui de février', 'Je veux garder deux CrossFit, un HYROX et progresser en running'],
  progress: ['Pourquoi je ne progresse plus en allure ?', 'Regarde mes trois dernières sorties et dis-moi ce qui change', 'Prépare-moi pour mon prochain 10 km'],
};

/** Coach Studio : conversation, cartes structurées, actions confirmées. Ouvert depuis Aujourd'hui, Programme ou Progression. */
export default function CoachStudio() {
  const { context, q, thread: threadParam } = useLocalSearchParams<{ context?: string; q?: string; thread?: string }>();
  const s = useApp(); const { c } = useTheme(); const today = sportDay();
  const [threadId, setThreadId] = useState<string | null>(threadParam || null); const [text, setText] = useState(q || ''); const [busy, setBusy] = useState(false); const [note, setNote] = useState('');
  const th = threadById(s, threadId); const msgs = th?.messages || []; const prov = providerFor(s);
  const sugg = CONTEXT_SUGGESTIONS[context || ''] || SUGGESTIONS.slice(0, 4);
  const [, setReady] = useState(0); useEffect(() => { setupRemoteCoach().then(() => setReady(x => x + 1)); }, []);

  const [files, setFiles] = useState<Attachment[]>([]);
  const voice = useDictation(setText);
  async function attach(kind: 'photo' | 'file') {
    if (files.length >= MAX_ATTACHMENTS) { setNote(`${MAX_ATTACHMENTS} pièces jointes maximum par message.`); return; }
    const r = kind === 'photo' ? await pickPhoto() : await pickFile();
    if (!r) return; if (!r.ok) { setNote(r.message); return; }
    haptic('select'); setNote(''); setFiles(f => [...f, r.item]);
  }
  async function send(input = text) {
    const t = input.trim(); if ((!t && !files.length) || busy) return;
    if (voice.listening) voice.stop();
    const sent = files; setBusy(true); setText(''); setFiles([]); setNote(''); haptic('select');
    const user: CoachMsg = { id: Math.random().toString(36).slice(2, 10), role: 'user', at: Date.now(), text: t.slice(0, 500), files: sent.length ? sent.map(f => ({ name: f.name, kind: f.kind })) : undefined };
    const reply = await ask(getState(), t, today, msgs, undefined, sent);
    let id = threadId; update(st => { id = appendMessages(st, threadId, [user, reply]); }); setThreadId(id); setBusy(false);
  }
  function onDecide(m: CoachMsg, cardId: string, accept: boolean) {
    let res = { ok: false, message: '' }; update(st => { res = decide(st, threadId!, m.id, cardId, accept, today); });
    haptic(res.ok && accept ? 'success' : 'select'); setNote(res.message);
  }

  const canSend = (!!text.trim() || files.length > 0) && !busy;
  const composer = (<View style={{ gap: space.s2 }}>
    {voice.listening ? <View accessibilityLiveRegion="polite"><T v="xs" color={c.stop} style={{ fontWeight: '700' }}>● Je t'écoute… appuie sur ■ quand tu as fini</T></View> : voice.error ? <T v="xs" color={c.warn}>{voice.error}</T> : null}
    {files.length ? <Row gap={6} style={{ flexWrap: 'wrap' }}>{files.map((f, i) => (
      <Pressable key={i} accessibilityRole="button" accessibilityLabel={`Retirer ${f.name}`} onPress={() => setFiles(x => x.filter((_, k) => k !== i))}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surface2, borderRadius: 14, paddingVertical: 4, paddingLeft: f.kind === 'image' ? 4 : 10, paddingRight: 10, maxWidth: '100%' }}>
        {f.kind === 'image' ? <Image source={{ uri: f.uri }} style={{ width: 28, height: 28, borderRadius: 8 }} /> : null}
        <T v="xs" numberOfLines={1} style={{ maxWidth: 160 }}>{f.kind === 'image' ? 'Photo' : f.name}</T><T v="xs" muted>✕</T>
      </Pressable>))}</Row> : null}
    <Row gap={space.s2}>
      <Pressable accessibilityRole="button" accessibilityLabel="Joindre une photo ou un fichier" disabled={busy} hitSlop={4}
        onPress={() => Alert.alert('Joindre', 'Claude peut lire une photo (repas, écran de montre, plan, blessure…), un PDF ou un fichier texte.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Fichier', onPress: () => attach('file') }, { text: 'Photo', onPress: () => attach('photo') }])}
        style={({ pressed }) => ({ width: 44, height: 48, borderRadius: 22, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
        <Icon name="plus" size={24} color={c.ink2} />
      </Pressable>
      <Input style={{ flex: 1 }} value={text} onChangeText={setText} placeholder={voice.listening ? 'Parle, le texte s\'écrit ici…' : 'Demande à ton coach…'} maxLength={500} returnKeyType="send" onSubmitEditing={() => send()} accessibilityLabel="Message au coach" />
      {voice.supported ? <Pressable accessibilityRole="button" accessibilityLabel={voice.listening ? 'Arrêter la dictée' : 'Dicter un message'} disabled={busy} hitSlop={4}
        onPress={() => { haptic('select'); if (voice.listening) voice.stop(); else voice.start(text); }}
        style={({ pressed }) => ({ width: 44, height: 48, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: voice.listening ? c.stopSoft : 'transparent', opacity: pressed ? 0.6 : 1 })}>
        {voice.listening ? <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: c.stop }} /> : <Icon name="mic" size={22} color={c.ink2} />}
      </Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Envoyer" disabled={!canSend} onPress={() => send()} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, backgroundColor: canSend ? c.accent : c.surface2, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
        <T v="label" color={canSend ? c.accentInk : c.ink3} style={{ fontSize: 20 }}>↑</T>
      </Pressable>
    </Row>
  </View>);

  return (
    <Sheet title="Coach" sub={prov.id === 'claude' ? 'Claude, avec tes données BYYND' : `${prov.name}, règles locales`} footer={composer} scrollEndKey={msgs.length + (busy ? 1 : 0)}>
      <Row gap={space.s2} style={{ marginBottom: space.s4, flexWrap: 'wrap' }}>
        {threadId ? <Button small label="Nouvelle conversation" onPress={() => { setThreadId(null); setNote(''); }} /> : null}
        {s.coach?.provider === 'local' ? <View style={{ width: '100%', backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s3, gap: space.s2 }}>
          <T v="small" style={{ fontWeight: '700' }}>Mode règles locales</T>
          <T v="small" muted>Ce coach simple ne comprend que quelques phrases et ne lit pas les photos. Claude comprend tout, avec tes données.</T>
          <Button small kind="primary" style={{ alignSelf: 'flex-start' }} label="Passer à Claude" onPress={() => { update(st => { ensureMemory(st).provider = 'claude'; }); haptic('select'); }} />
        </View> : null}
        {prov.id !== 'claude' && s.coach?.provider !== 'local' ? <View style={{ width: '100%', backgroundColor: c.warnSoft, borderRadius: radius.r2, padding: space.s3 }}><T v="small" color={c.warn} style={{ fontWeight: '700' }}>Claude n'est pas actif</T><T v="small">{remoteDetail()}</T></View> : null}
        <Button small kind="ghost" style={{ paddingHorizontal: 0 }} label={`Historique et données${memory(s).threads.length ? ` (${memory(s).threads.length})` : ''}`} onPress={() => router.push('/coach-settings')} />
      </Row>

      {!msgs.length ? <>
        <T v="small" muted style={{ marginBottom: space.s2 }}>Essaie</T>
        <View style={{ gap: 8, marginBottom: space.s5 }}>{sugg.map(x => <Pressable key={x} accessibilityRole="button" onPress={() => send(x)} style={({ pressed }) => ({ backgroundColor: pressed ? c.surface2 : c.surface, borderRadius: radius.r2, paddingVertical: 12, paddingHorizontal: space.s4 })}><T>{x}</T></Pressable>)}</View>
        <CoachGuided />
      </> : msgs.map(m => m.role === 'user'
        ? <View key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: c.accentSoft, borderRadius: 18, borderBottomRightRadius: 6, paddingVertical: 10, paddingHorizontal: 14, marginBottom: space.s3, gap: 4 }}>
          {(m.files || []).map((f, i) => <T key={i} v="xs" color={c.accent} style={{ fontWeight: '600' }}>{`📎 ${attachmentLabel(f)}`}</T>)}{m.text ? <T>{m.text}</T> : null}</View>
        : <View key={m.id} style={{ marginBottom: space.s4 }}>
          <Row gap={8} style={{ alignItems: 'flex-start' }}><Icon name="coach" size={18} color={c.accent} /><T style={{ flex: 1 }}>{m.text}</T></Row>
          {(m.cards || []).map(cd => <CoachCardView key={cd.id} card={cd} decision={m.decisions?.[cd.id]} onDecide={cd.kind === 'action' || cd.kind === 'program' ? a => onDecide(m, cd.id, a) : undefined} />)}
          {m.scopes?.length ? <T v="xs" muted style={{ marginTop: 6 }}>{`Données utilisées : ${m.scopes.map(x => SCOPE_LABEL[x].toLowerCase()).join(', ')}.`}</T> : null}
        </View>)}
      {busy ? <T muted>{prov.id === 'claude' ? 'Claude réfléchit…' : '…'}</T> : null}
      {note ? <View accessibilityLiveRegion="polite" style={{ marginBottom: space.s3 }}><T v="small" color={c.accent}>{note}</T></View> : null}
      {msgs.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.s2 }}>{sugg.slice(0, 2).map(x => <Button key={x} small label={x.length > 34 ? x.slice(0, 33) + '…' : x} onPress={() => send(x)} />)}</View> : null}
      <T v="xs" muted style={{ marginTop: space.s5 }}>Le coach propose, tu décides : rien ne change sans ton accord. Il ne remplace pas un avis médical.</T>
    </Sheet>
  );
}
