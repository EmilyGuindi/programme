import { router } from 'expo-router';
import { Text, View } from 'react-native';
import type { CoachCard } from '@/engine/types';
import { font, radius, space, useTheme } from '@/theme/tokens';
import { Button, Row, T } from './ui';

type Sev = 'block' | 'warn' | 'info' | 'ok';
function IssueList({ issues }: { issues: { severity: Sev; text: string }[] }) {
  const { c } = useTheme();
  return <View style={{ gap: 4, marginTop: space.s2 }}>{issues.map((i, k) => { const col = i.severity === 'block' ? c.stop : i.severity === 'warn' ? c.warn : i.severity === 'ok' ? c.ok : c.ink2;
    return <Row key={k} gap={8} style={{ alignItems: 'flex-start' }}><T v="small" color={col} style={{ fontWeight: '700', width: 10 }}>{i.severity === 'ok' ? '✓' : i.severity === 'info' ? '·' : '!'}</T><T v="small" style={{ flex: 1 }}>{i.text}</T></Row>; })}</View>;
}

/** Rendu natif des cartes du coach. Le contenu n'est que du texte affiché : aucun HTML, aucun lien, aucun code n'est interprété. */
export function CoachCardView({ card, decision, onDecide }: { card: CoachCard; decision?: 'accepted' | 'refused'; onDecide?: (accept: boolean) => void }) {
  const { c } = useTheme();
  const box = { backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4, marginTop: space.s2 } as const;
  if (card.kind === 'facts') return <View style={box}><T v="label" style={{ marginBottom: 6 }}>{card.title}</T>{card.items.map((x, i) => <Row key={i} gap={8} style={{ alignItems: 'flex-start', marginBottom: 4 }}><T color={c.accent}>•</T><T v="small" style={{ flex: 1 }}>{x}</T></Row>)}</View>;
  if (card.kind === 'week') return <View style={box}><T v="label" style={{ marginBottom: 6 }}>{card.title}</T>{card.days.map(d => <Row key={d.date} gap={space.s3} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.line }}><T v="small" muted style={{ width: 36 }}>{d.label}</T><T v="small" style={{ flex: 1, fontWeight: d.changed ? '700' : '400' }} color={d.changed ? c.accent : undefined}>{d.title}</T></Row>)}</View>;
  if (card.kind === 'compare') return <View style={box}><T v="label" style={{ marginBottom: 6 }}>{card.title}</T>
    <Row gap={6}>{card.head.map(h => <T key={h} v="xs" muted style={{ flex: 1 }}>{h}</T>)}</Row>
    {card.rows.map((r, i) => <Row key={i} gap={6} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.line }}>{r.map((x, k) => <T key={k} v="small" style={{ flex: 1, fontVariant: ['tabular-nums'] }}>{x}</T>)}</Row>)}</View>;
  const blocked = card.issues.some(i => i.severity === 'block');
  const actions = decision ? <T v="small" color={decision === 'accepted' ? c.ok : c.ink2} style={{ marginTop: space.s3, fontWeight: '600' }}>{decision === 'accepted' ? (card.kind === 'program' && (card.accept || '').startsWith('Appliquer') ? 'Nouveau plan appliqué' : card.kind === 'program' ? 'Brouillon enregistré' : 'Appliqué') : 'Refusé : rien n\'a changé'}</T>
    : onDecide ? <View style={{ marginTop: space.s3, gap: space.s2 }}>
      <Button kind="primary" block disabled={blocked} label={blocked ? 'Bloqué par les règles BYYND' : card.kind === 'program' ? card.accept || 'Enregistrer le brouillon' : 'Accepter'} onPress={() => onDecide(true)} />
      <Row gap={space.s2}>{card.modify ? <Button style={{ flex: 1 }} label="Modifier" onPress={() => router.push(card.modify as any)} /> : null}<Button style={{ flex: 1 }} kind="ghost" label="Refuser" onPress={() => onDecide(false)} /></Row>
    </View> : null;
  if (card.kind === 'program') return <View style={box}>
    <T v="overline" color={c.accent}>{(card.accept || '').startsWith('Appliquer') ? 'Changement de plan' : 'Brouillon de programme'}</T><T v="label" style={{ marginTop: 2 }}>{card.title}</T><T v="small" muted>{card.summary}</T>
    <T v="xs" muted style={{ marginTop: space.s3 }}>Phases</T><T v="small">{card.phases.join(' → ')}</T>
    <T v="xs" muted style={{ marginTop: space.s3 }}>Semaine 1</T>{card.week.map(w => <Row key={w.label} gap={space.s3}><T v="small" muted style={{ width: 36 }}>{w.label}</T><T v="small" style={{ flex: 1 }}>{w.detail}</T></Row>)}
    <IssueList issues={card.issues} />{actions}
  </View>;
  return <View style={box}>
    <T v="overline" color={c.accent}>Proposition</T><T v="label" style={{ marginTop: 2 }}>{card.title}</T>
    {card.consequences.length ? <View style={{ marginTop: 6, gap: 2 }}>{card.consequences.map((x, i) => <T key={i} v="small" muted={i > 0}>{x}</T>)}</View> : null}
    {card.issues.length ? <IssueList issues={card.issues} /> : null}{actions}
  </View>;
}

/** Texte du coach avec une mise en forme minimale : **gras**, listes « - » ou « 1. », titres « # » rendus en gras.
 *  Analyse maison en composants natifs : aucun HTML ni Markdown n'est interprété par un moteur de rendu. */
export function RichText({ text }: { text: string }) {
  const { c } = useTheme();
  const inline = (s: string, key: string) => s.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <Text key={`${key}-${i}`} style={{ fontFamily: font.semibold, color: c.ink }}>{p.slice(2, -2)}</Text> : <Text key={`${key}-${i}`}>{p.replace(/\*\*/g, '')}</Text>);
  const lines = text.replace(/\r/g, '').split('\n');
  return <View style={{ gap: 4 }}>{lines.map((raw, i) => {
    const l = raw.trimEnd(); if (!l.trim()) return <View key={i} style={{ height: 4 }} />;
    const h = l.match(/^#{1,4}\s+(.*)$/); if (h) return <T key={i} v="label">{h[1].replace(/\*\*/g, '')}</T>;
    const b = l.match(/^\s*(?:[-•*]|(\d+)[.)])\s+(.*)$/);
    if (b) return <Row key={i} gap={8} style={{ alignItems: 'flex-start', paddingLeft: /^\s{2,}/.test(l) ? 16 : 0 }}><T color={c.accent} style={{ minWidth: 14 }}>{b[1] ? `${b[1]}.` : '•'}</T><T style={{ flex: 1 }}>{inline(b[2], `l${i}`)}</T></Row>;
    return <T key={i}>{inline(l, `l${i}`)}</T>;
  })}</View>;
}
