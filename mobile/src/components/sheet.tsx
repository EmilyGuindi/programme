import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { space, useTheme } from '@/theme/tokens';
import { Ambient, Row, T } from './ui';
import { GlassSurface } from './glass';
import { Pressable } from 'react-native';

/** Feuille de détail. `footer` : action principale flottante en verre, toujours accessible. */
export function Sheet({ title, sub, children, footer }: { title: string; sub?: string; children: ReactNode; footer?: ReactNode }) {
  const { c } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }}>
      <Ambient />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Row between style={{ paddingHorizontal: space.s4, paddingTop: space.s4, paddingBottom: space.s3 }}>
          <View style={{ flex: 1 }}>{sub ? <T v="overline" muted>{sub}</T> : null}<T v="h2" style={{ marginTop: sub ? 2 : 0 }}>{title}</T></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={10} onPress={() => router.back()} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, backgroundColor: pressed ? c.line2 : c.surface2, alignItems: 'center', justifyContent: 'center' })}><T v="label" style={{ fontSize: 15 }}>✕</T></Pressable>
        </Row>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.s4, paddingBottom: footer ? 130 : 60, maxWidth: 560, width: '100%', alignSelf: 'center' }}>{children}</ScrollView>
        {footer ? <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 16, alignItems: 'center' }}><GlassSurface r={28} style={{ width: '92%', maxWidth: 520 }}><View style={{ padding: 8 }}>{footer}</View></GlassSurface></View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
