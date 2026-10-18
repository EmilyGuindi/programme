import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { Move } from '@/engine/guides';
import { radius, space, useTheme } from '@/theme/tokens';
import { Card, Chevron, Row, T, Tick } from './ui';

/** Section repliable : l'essentiel visible, le détail à la demande. */
export function Disclosure({ title, sub, children, open: initial = false }: { title: string; sub?: string; children: ReactNode; open?: boolean }) {
  const { c } = useTheme(); const [open, setOpen] = useState(initial);
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, marginBottom: space.s3 }}>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ padding: space.s4, flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
        <View style={{ flex: 1 }}><T v="label">{title}</T>{sub ? <T v="small" muted>{sub}</T> : null}</View>
        <View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}><Chevron /></View>
      </Pressable>
      {open ? <View style={{ paddingHorizontal: space.s4, paddingBottom: space.s4 }}>{children}</View> : null}
    </View>
  );
}

export function Bullets({ items, numbered }: { items: string[]; numbered?: boolean }) {
  return <View style={{ gap: 4 }}>{items.map((t, i) => <Row key={i} gap={8} style={{ alignItems: 'flex-start' }}><T v="small" muted style={{ width: 16 }}>{numbered ? `${i + 1}.` : '·'}</T><T v="small" style={{ flex: 1 }}>{t}</T></Row>)}</View>;
}

/** Liste d'exercices de mobilité ou d'échauffement, chacun cochable et dépliable. */
export function MoveList({ moves }: { moves: Move[] }) {
  const { c } = useTheme(); const [done, setDone] = useState<Record<number, boolean>>({}); const [open, setOpen] = useState<number | null>(null);
  return (
    <Card style={{ paddingVertical: space.s2 }}>
      {moves.map((m, i) => (
        <View key={m.name} style={{ paddingVertical: space.s3, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
          <Row style={{ alignItems: 'flex-start' }}>
            <Tick sizePx={30} on={!!done[i]} label={m.name} onPress={() => setDone({ ...done, [i]: !done[i] })} />
            <Pressable style={{ flex: 1 }} accessibilityRole="button" accessibilityState={{ expanded: open === i }} accessibilityHint="Afficher les consignes" onPress={() => setOpen(open === i ? null : i)}>
              <Row between><T v="label" style={{ flex: 1 }}>{m.name}</T><Chevron open={open === i} /></Row>
              <T v="small" muted>{m.dose}</T>
            </Pressable>
          </Row>
          {open === i ? <View style={{ marginTop: space.s2, marginLeft: 42, gap: 6 }}>
            <Bullets items={m.how} numbered />
            {m.why ? <T v="small"><T v="small" style={{ fontWeight: '600' }}>Pourquoi : </T>{m.why}</T> : null}
            {m.feel ? <T v="small"><T v="small" style={{ fontWeight: '600' }}>Ce que tu dois sentir : </T>{m.feel}</T> : null}
          </View> : null}
        </View>
      ))}
    </Card>
  );
}
