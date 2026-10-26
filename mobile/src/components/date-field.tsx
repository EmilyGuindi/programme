import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Chevron, Row, T } from '@/components/ui';
import { addDays, dow, fmtDay, iso, parseISO } from '@/engine/dates';
import type { ISODate } from '@/engine/types';
import { haptic } from '@/feedback';
import { radius, space, useTheme } from '@/theme/tokens';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Choix d'une date précise : la date en clair, et un calendrier du mois qui s'ouvre au toucher (sans module natif). */
export function DateField({ value, onChange, min, max, label }: { value: ISODate; onChange: (d: ISODate) => void; min?: ISODate; max?: ISODate; label: string }) {
  const { c } = useTheme(); const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value.slice(0, 7) + '-01');
  const first = parseISO(month); const startGrid = addDays(month, -dow(month));
  const next = iso(new Date(first.getFullYear(), first.getMonth() + 1, 1)), prevM = iso(new Date(first.getFullYear(), first.getMonth() - 1, 1));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(startGrid, i)).filter((d, i) => i < 35 || d.slice(0, 7) === month.slice(0, 7));
  const ok = (d: ISODate) => (!min || d >= min) && (!max || d <= max);
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} : ${fmtDay(value)}. Changer la date`} onPress={() => { setMonth(value.slice(0, 7) + '-01'); setOpen(o => !o); }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', minHeight: 48, borderRadius: radius.r1, borderWidth: 1, borderColor: open ? c.accent : c.line2, backgroundColor: pressed ? c.surface2 : c.surface, paddingHorizontal: 14 })}>
        <T style={{ flex: 1 }}>{fmtDay(value).replace(/^./, x => x.toUpperCase())}</T><T v="small" color={c.accent} style={{ fontWeight: '600' }}>{open ? 'Fermer' : 'Changer'}</T>
      </Pressable>
      {open ? <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s3, marginTop: space.s2 }}>
        <Row between style={{ marginBottom: space.s2 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Mois précédent" hitSlop={8} onPress={() => setMonth(prevM)} style={{ padding: 8, transform: [{ scaleX: -1 }] }}><Chevron /></Pressable>
          <T v="label">{`${MONTHS[first.getMonth()].replace(/^./, x => x.toUpperCase())} ${first.getFullYear()}`}</T>
          <Pressable accessibilityRole="button" accessibilityLabel="Mois suivant" hitSlop={8} onPress={() => setMonth(next)} style={{ padding: 8 }}><Chevron /></Pressable>
        </Row>
        <View style={{ flexDirection: 'row' }}>{LETTERS.map((l, i) => <T key={i} v="xs" muted style={{ width: `${100 / 7}%`, textAlign: 'center', marginBottom: 4 }}>{l}</T>)}</View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{cells.map(d => {
          const inMonth = d.slice(0, 7) === month.slice(0, 7); const sel = d === value; const can = ok(d);
          return <Pressable key={d} disabled={!can} accessibilityRole="button" accessibilityLabel={fmtDay(d)} accessibilityState={{ selected: sel, disabled: !can }}
            onPress={() => { haptic('select'); onChange(d); setOpen(false); }}
            style={{ width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? c.accent : 'transparent' }}>
              <T v="small" color={sel ? c.accentInk : !can ? c.ink3 : inMonth ? c.ink : c.ink3} style={{ fontWeight: sel ? '700' : '400', opacity: can ? 1 : 0.4 }}>{String(+d.slice(8))}</T>
            </View>
          </Pressable>;
        })}</View>
      </View> : null}
    </View>
  );
}
