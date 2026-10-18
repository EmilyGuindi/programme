import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ask, appendMessages, decide, memory, providerFor, threadById } from '@/ai/studio';
import { SUGGESTIONS } from '@/ai/local';
import { setupRemoteCoach } from '@/ai/remote';
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

  async function send(input = text) {
    const t = input.trim(); if (!t || busy) return;
    setBusy(true); setText(''); setNote(''); haptic('select');
    const user: CoachMsg = { id: Math.random().toString(36).slice(2, 10), role: 'user', at: Date.now(), text: t.slice(0, 500) };
    const reply = await ask(getState(), t, today, msgs);
    let id = threadId; update(st => { id = appendMessages(st, threadId, [user, reply]); }); setThreadId(id); setBusy(false);
  }
  function onDecide(m: CoachMsg, cardId: string, accept: boolean) {
    let res = { ok: false, message: '' }; update(st => { res = decide(st, threadId!, m.id, cardId, accept, today); });
    haptic(res.ok && accept ? 'success' : 'select'); setNote(res.message);
  }

  const composer = (
    <Row gap={space.s2}>
      <Input style={{ flex: 1 }} value={text} onChangeText={setText} placeholder="Demande à ton coach…" maxLength={500} returnKeyType="send" onSubmitEditing={() => send()} accessibilityLabel="Message au coach" />
      <Pressable accessibilityRole="button" accessibilityLabel="Envoyer" disabled={!text.trim() || busy} onPress={() => send()} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, backgroundColor: text.trim() ? c.accent : c.surface2, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
        <T v="label" color={text.trim() ? c.accentInk : c.ink3} style={{ fontSize: 20 }}>↑</T>
      </Pressable>
    </Row>
  );

  return (
    <Sheet title="Coach" sub={prov.id === 'claude' ? 'Claude, avec tes données BYYND' : `${prov.name}, règles locales`} footer={composer} scrollEndKey={msgs.length + (busy ? 1 : 0)}>
      <Row gap={space.s2} style={{ marginBottom: space.s4, flexWrap: 'wrap' }}>
        {threadId ? <Button small label="Nouvelle conversation" onPress={() => { setThreadId(null); setNote(''); }} /> : null}
        {prov.id !== 'claude' && s.coach?.provider !== 'local' ? <View style={{ width: '100%', backgroundColor: c.warnSoft, borderRadius: radius.r2, padding: space.s3 }}><T v="small" color={c.warn} style={{ fontWeight: '700' }}>Claude n'est pas actif</T><T v="small">{remoteDetail()}</T></View> : null}
        <Button small kind="ghost" style={{ paddingHorizontal: 0 }} label={`Historique et données${memory(s).threads.length ? ` (${memory(s).threads.length})` : ''}`} onPress={() => router.push('/coach-settings')} />
      </Row>

      {!msgs.length ? <>
        <T v="small" muted style={{ marginBottom: space.s2 }}>Essaie</T>
        <View style={{ gap: 8, marginBottom: space.s5 }}>{sugg.map(x => <Pressable key={x} accessibilityRole="button" onPress={() => send(x)} style={({ pressed }) => ({ backgroundColor: pressed ? c.surface2 : c.surface, borderRadius: radius.r2, paddingVertical: 12, paddingHorizontal: space.s4 })}><T>{x}</T></Pressable>)}</View>
        <CoachGuided />
      </> : msgs.map(m => m.role === 'user'
        ? <View key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: c.accentSoft, borderRadius: 18, borderBottomRightRadius: 6, paddingVertical: 10, paddingHorizontal: 14, marginBottom: space.s3 }}><T>{m.text}</T></View>
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
