import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { ask, appendMessages, decide, ensureMemory, memory, providerFor, threadById } from '@/ai/studio';
import { registerClaude, setupRemoteCoach } from '@/ai/remote';

registerClaude(); // Claude prêt dès l'ouverture de l'écran, sans attendre le réseau
import { useDictation } from '@/ai/voice';
import { attachmentLabel, MAX_ATTACHMENTS, pickFile, pickPhoto, type Attachment } from '@/ai/attachments';
import { remoteDetail } from '@/ai/claude';
import { CoachCardView, RichText } from '@/components/coach-cards';
import { Icon, type IconName } from '@/components/icons';
import { Sheet } from '@/components/sheet';
import { Button, Input, Row, T } from '@/components/ui';
import { daysBetween, sportDay } from '@/engine/dates';
import { adapted, doneOn, recovery } from '@/engine/coach';
import { nextEvent } from '@/engine/race';
import { SCOPE_LABEL } from '@/engine/tools';
import type { AppState, CoachMsg, ISODate } from '@/engine/types';
import { haptic, useReducedMotion } from '@/feedback';
import { getState, update, useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';


/** Coach Studio : conversation, cartes structurées, actions confirmées. Ouvert depuis Aujourd'hui, Programme ou Progression. */
export default function CoachStudio() {
  const { context, q, thread: threadParam, focus } = useLocalSearchParams<{ context?: string; q?: string; thread?: string; focus?: string }>();
  const s = useApp(); const { c } = useTheme(); const today = sportDay();
  const [threadId, setThreadId] = useState<string | null>(threadParam || null); const [text, setText] = useState(q || ''); const [busy, setBusy] = useState(false); const [note, setNote] = useState('');
  const th = threadById(s, threadId); const msgs = th?.messages || []; const prov = providerFor(s);
  const [, setReady] = useState(0); useEffect(() => { setupRemoteCoach().then(() => setReady(x => x + 1)); }, []);

  const [files, setFiles] = useState<Attachment[]>([]);
  /** Message en cours : le tien, affiché tout de suite, et la réponse qui s'écrit. */
  const [pending, setPending] = useState<{ user: CoachMsg; text: string; since: number } | null>(null);
  /** Pièces jointes déjà envoyées dans cette conversation : gardées en mémoire vive (jamais enregistrées) et renvoyées tant que l'écran est ouvert. */
  const carried = useRef<Attachment[]>([]);
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
    const all = [...sent, ...carried.current.filter(x => !sent.some(y => y.name === x.name))].slice(0, MAX_ATTACHMENTS);
    setPending({ user, text: '', since: Date.now() }); // ton message s'affiche tout de suite
    const reply = await ask(getState(), t, today, msgs, undefined, all, txt => setPending(p => p && { ...p, text: txt }));
    if (sent.length) carried.current = all;
    let id = threadId; update(st => { id = appendMessages(st, threadId, [user, reply]); }); setThreadId(id); setBusy(false); setPending(null);
    haptic('success');
  }
  function onDecide(m: CoachMsg, cardId: string, accept: boolean) {
    let res = { ok: false, message: '' }; update(st => { res = decide(st, threadId!, m.id, cardId, accept, today); });
    haptic(res.ok && accept ? 'success' : 'select'); setNote(res.message);
  }

  /** Propositions encore ouvertes d'un message, applicables (non bloquées). */
  const openCards = (m: CoachMsg) => (m.cards || []).filter(cd => (cd.kind === 'action' || cd.kind === 'program') && !m.decisions?.[cd.id] && !cd.issues.some(i => i.severity === 'block'));
  function applyAll(m: CoachMsg) {
    const ids = openCards(m).map(cd => cd.id); let ok = 0, ko = 0; let last = '';
    update(st => { for (const id of ids) { const r = decide(st, threadId!, m.id, id, true, today); if (r.ok) ok++; else { ko++; last = r.message; } } });
    haptic(ko ? 'select' : 'success'); setNote(ko ? `${ok} appliquée${ok > 1 ? 's' : ''}, ${ko} refusée${ko > 1 ? 's' : ''} par les règles : ${last}` : `${ok} changements appliqués.`);
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
      <Input style={{ flex: 1 }} autoFocus={focus === '1'} value={text} onChangeText={setText} placeholder={voice.listening ? 'Je t\'écoute…' : 'Message'} maxLength={500} returnKeyType="send" onSubmitEditing={() => send()} accessibilityLabel="Message au coach" />
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
    <Sheet title="Coach" sub={prov.id === 'claude' ? 'Claude, avec tes données BYYND' : `${prov.name}, règles locales`} footer={composer} scrollEndKey={msgs.length * 1000 + (pending ? 1 + Math.floor(pending.text.length / 60) : 0)}>
      {/* Barre d'outils discrète : nouvelle conversation et historique, rien d'autre. */}
      <Row between style={{ marginBottom: space.s3, minHeight: 32 }}>
        {threadId && !busy ? <Button small kind="ghost" style={{ paddingHorizontal: 0 }} label="＋ Nouvelle conversation" onPress={() => { setThreadId(null); setNote(''); carried.current = []; }} /> : <View />}
        <Button small kind="ghost" style={{ paddingHorizontal: 0 }} label={`Historique${memory(s).threads.length ? ` (${memory(s).threads.length})` : ''}`} onPress={() => router.push('/coach-settings')} />
      </Row>
      {s.coach?.provider === 'local' ? <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s3, gap: space.s2, marginBottom: space.s4 }}>
        <T v="small" style={{ fontWeight: '700' }}>Mode règles locales</T>
        <T v="small" muted>Ce coach simple ne comprend que quelques phrases. Claude comprend tout et modifie tes séances.</T>
        <Button small kind="primary" style={{ alignSelf: 'flex-start' }} label="Passer à Claude" onPress={() => { update(st => { ensureMemory(st).provider = 'claude'; }); haptic('select'); }} />
      </View> : null}
      {prov.id !== 'claude' && s.coach?.provider !== 'local' && remoteDetail() ? <View style={{ backgroundColor: c.warnSoft, borderRadius: radius.r2, padding: space.s3, marginBottom: space.s4 }}><T v="small" color={c.warn} style={{ fontWeight: '700' }}>Claude n'est pas actif</T><T v="small">{remoteDetail()}</T></View> : null}

      {!msgs.length && !pending ? <>
        <Brief />
        <T v="h3" style={{ marginTop: space.s5, marginBottom: space.s1 }}>Que veux-tu faire ?</T>
        <T v="small" muted style={{ marginBottom: space.s3 }}>Le coach connaît ton programme, tes séances et ta forme. Il propose, tu valides d'un geste.</T>
        <View style={{ gap: space.s2 }}>{actionsFor(s, today, context).map(x => (
          <Pressable key={x.title} accessibilityRole="button" accessibilityLabel={x.title} accessibilityHint={x.sub}
            onPress={() => { haptic('select'); if (x.send) send(x.send); else setText(x.fill || ''); }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.s3, backgroundColor: pressed ? c.surface2 : c.surface, borderRadius: radius.r2, paddingVertical: 14, paddingHorizontal: space.s4 })}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={x.icon} size={18} color={c.accent} /></View>
            <View style={{ flex: 1 }}><T v="label">{x.title}</T><T v="xs" muted>{x.sub}</T></View>
            <T muted>{x.send ? '›' : '✎'}</T>
          </Pressable>))}</View>
        <T v="xs" muted style={{ marginTop: space.s4 }}>Ou écris-lui librement, ou dicte avec le micro : « remplace mon CrossFit de jeudi par un footing », « que manger avant ma compet ? »…</T>
      </> : msgs.map(m => m.role === 'user'
        ? <View key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: c.accentSoft, borderRadius: 18, borderBottomRightRadius: 6, paddingVertical: 10, paddingHorizontal: 14, marginBottom: space.s3, gap: 4 }}>
          {(m.files || []).map((f, i) => <T key={i} v="xs" color={c.accent} style={{ fontWeight: '600' }}>{`📎 ${attachmentLabel(f)}`}</T>)}{m.text ? <T>{m.text}</T> : null}</View>
        : <View key={m.id} style={{ marginBottom: space.s4 }}>
          <Row gap={8} style={{ alignItems: 'flex-start' }}><Icon name="coach" size={18} color={c.accent} /><View style={{ flex: 1 }}><RichText text={m.text} /></View></Row>
          {(m.memo || []).map((n, i) => <T key={i} v="xs" color={c.ink2} style={{ marginTop: 6 }}>{`📝 Retenu : ${n}`}</T>)}
          {openCards(m).length >= 2 ? <Button kind="primary" block style={{ marginTop: space.s3 }} label={`Tout appliquer (${openCards(m).length})`} onPress={() => applyAll(m)} /> : null}
          {(m.cards || []).map(cd => <CoachCardView key={cd.id} card={cd} decision={m.decisions?.[cd.id]} onDecide={cd.kind === 'action' || cd.kind === 'program' ? a => onDecide(m, cd.id, a) : undefined} />)}
          {m.scopes?.length ? <T v="xs" muted style={{ marginTop: 6 }}>{`Données utilisées : ${m.scopes.map(x => SCOPE_LABEL[x].toLowerCase()).join(', ')}.`}</T> : null}
        </View>)}
      {pending ? <>
        <View style={{ alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: c.accentSoft, borderRadius: 18, borderBottomRightRadius: 6, paddingVertical: 10, paddingHorizontal: 14, marginBottom: space.s3, gap: 4 }}>
          {(pending.user.files || []).map((f, i) => <T key={i} v="xs" color={c.accent} style={{ fontWeight: '600' }}>{`📎 ${attachmentLabel(f)}`}</T>)}{pending.user.text ? <T>{pending.user.text}</T> : null}</View>
        <View style={{ marginBottom: space.s4 }} accessibilityLiveRegion="polite">
          <Row gap={8} style={{ alignItems: 'flex-start' }}><Icon name="coach" size={18} color={c.accent} />
            <View style={{ flex: 1 }}>{pending.text ? <RichText text={pending.text} /> : <Thinking since={pending.since} label={prov.id === 'claude' ? 'Claude réfléchit' : 'Le coach réfléchit'} />}</View></Row>
        </View>
      </> : null}
      {note ? <View accessibilityLiveRegion="polite" style={{ marginBottom: space.s3 }}><T v="small" color={c.accent}>{note}</T></View> : null}
      <T v="xs" muted style={{ marginTop: space.s5 }}>Rien ne change sans ton accord. Le coach ne remplace pas un avis médical.</T>
    </Sheet>
  );
}

/** Indicateur d'attente : trois points qui pulsent (fixes si les animations sont réduites) et le temps écoulé. */
function Thinking({ since, label }: { since: number; label: string }) {
  const { c } = useTheme(); const reduced = useReducedMotion(); const [n, setN] = useState(0);
  useEffect(() => { const t = setInterval(() => setN(x => x + 1), 400); return () => clearInterval(t); }, []);
  const secs = Math.floor((Date.now() - since) / 1000);
  return <Row gap={8} style={{ minHeight: 24 }}>
    <Row gap={4}>{[0, 1, 2].map(i => <View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.accent, opacity: reduced ? 0.7 : (n % 3 === i ? 1 : 0.3) }} />)}</Row>
    <T v="small" muted>{`${label}${secs >= 3 ? `, ${secs} s` : '…'}`}</T>
  </Row>;
}

type Action = { icon: IconName; title: string; sub: string; send?: string; fill?: string };
/** Les 4 à 5 choses que l'on vient vraiment demander au coach, formulées à partir des données du jour. */
function actionsFor(s: AppState, d: ISODate, context?: string): Action[] {
  const a = adapted(s, d); const sh = a.replaced || a; const ev = nextEvent(s, d, 90);
  const today: Action = a.type === 'rest' || a.type === 'event'
    ? { icon: 'today', title: 'Changer une séance', sub: 'Remplacer, alléger ou déplacer une séance de la semaine', fill: 'Change ma séance de ' }
    : { icon: 'today', title: 'Adapter ma séance du jour', sub: `${sh.title} : selon ta forme, ton temps, ton envie`, send: `Adapte ma séance d'aujourd'hui (${sh.title}) à ma forme du jour et propose-la directement.` };
  const xs: Action[] = [today,
    { icon: 'calendar', title: 'Réorganiser ma semaine', sub: 'Un empêchement, un jour en moins, une envie : dis-le', fill: 'Réorganise ma semaine : ' },
    ev ? { icon: 'flag', title: `Préparer ${ev.name}`, sub: `Dans ${daysBetween(d, ev.date)} jours : séances, affûtage, stratégie`, send: `Prépare-moi pour ${ev.name} (${ev.date}) : ajuste mes séances d'ici là et donne-moi la stratégie.` }
      : { icon: 'plan', title: 'Faire évoluer mon programme', sub: 'Changer les jours, l\'objectif, préparer la suite', fill: 'Je voudrais changer mon programme : ' },
    { icon: 'stats', title: 'Analyser ma progression', sub: 'Ce qui avance, ce qui coince, quoi changer', send: 'Analyse mes 4 dernières semaines : ce qui progresse, ce qui coince, et ce que tu changerais. Propose les changements directement.' },
    { icon: 'flame', title: 'Une question nutrition', sub: 'Avant, pendant, après l\'effort', fill: 'Nutrition : ' },
  ];
  return context === 'progress' ? [xs[3], xs[2], xs[0], xs[1], xs[4]] : context === 'program' ? [xs[1], xs[2], xs[0], xs[3], xs[4]] : xs;
}

/** Brief du jour : ce que le coach sait déjà, en trois lignes. */
function Brief() {
  const s = useApp(); const { c } = useTheme(); const d = sportDay(); const a = adapted(s, d); const sh = a.replaced || a; const r = recovery(s, d); const ev = nextEvent(s, d, 90);
  const lv = { vert: ['Forme au vert', c.ok], orange: ['Forme moyenne', c.warn], rouge: ['Récupération prioritaire', c.stop], inconnu: ['Pas encore de check-in', c.ink3] }[r.level] as [string, string];
  return <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4, gap: 6 }}>
    <T v="overline" color={c.accent}>Brief du jour</T>
    <T v="label">{a.type === 'rest' ? 'Jour de repos' : `${sh.title}${sh.dur ? `, ${sh.dur}` : ''}`}{doneOn(s, d) ? ' ✓' : ''}</T>
    <Row gap={6}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: lv[1] }} /><T v="small" muted style={{ flex: 1 }}>{r.level === 'inconnu' ? lv[0] : `${lv[0]} · ${r.reasons[0]}`}</T></Row>
    {ev ? <T v="small" muted>{`${ev.name} dans ${daysBetween(d, ev.date)} jours`}</T> : null}
  </View>;
}
