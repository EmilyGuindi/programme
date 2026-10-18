import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { layout, space, useTheme } from '@/theme/tokens';
import { Ambient, Row, T, useKeyboardLift } from './ui';
import { GlassSurface } from './glass';
import { Pressable } from 'react-native';

/** Feuille de détail. `footer` : action principale flottante en verre, toujours accessible. */
export function Sheet({ title, sub, children, footer, scrollEndKey }: { title: string; sub?: string; children: ReactNode; footer?: ReactNode; /** Change → défile jusqu'en bas (conversation). */ scrollEndKey?: number }) {
  const { c } = useTheme(); const [fh, setFh] = useState(110); const sv = useRef<ScrollView>(null); const kb = useKeyboardLift();
  useEffect(() => { if (scrollEndKey) setTimeout(() => sv.current?.scrollToEnd({ animated: true }), 80); }, [scrollEndKey]);
  // Clavier ouvert dans une conversation : on garde le dernier message visible au-dessus de la barre de saisie.
  useEffect(() => { if (kb && scrollEndKey != null) setTimeout(() => sv.current?.scrollToEnd({ animated: true }), 80); }, [kb]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }}>
      <Ambient />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Row between style={{ paddingHorizontal: layout.gutter, paddingTop: space.s4, paddingBottom: space.s3, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>{sub ? <T v="overline" muted>{sub}</T> : null}<T v="h2" style={{ marginTop: sub ? 2 : 0 }}>{title}</T></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={10} onPress={() => router.back()} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: pressed ? c.line2 : c.surface2, alignItems: 'center', justifyContent: 'center' })}><T v="label" style={{ fontSize: 15 }}>✕</T></Pressable>
        </Row>
        <ScrollView ref={sv} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: space.s2, paddingBottom: (footer ? fh + 40 : 60) + kb, maxWidth: 560, width: '100%', alignSelf: 'center' }}>{children}</ScrollView>
        {footer ? <View pointerEvents="box-none" style={{ position: 'absolute', left: layout.gutter, right: layout.gutter, bottom: 16 + kb, alignItems: 'center' }}><GlassSurface r={28} style={{ width: '100%', maxWidth: 520 - 2 * layout.gutter }}><View style={{ padding: 8 }} onLayout={e => setFh(e.nativeEvent.layout.height)}>{footer}</View></GlassSurface></View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

