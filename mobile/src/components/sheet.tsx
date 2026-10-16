import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { space, useTheme } from '@/theme/tokens';
import { Row, T } from './ui';
import { Pressable } from 'react-native';

export function Sheet({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Row between style={{ paddingHorizontal: space.s4, paddingTop: space.s4, paddingBottom: space.s3 }}>
          <View style={{ flex: 1 }}>{sub ? <T v="overline" muted>{sub}</T> : null}<T v="h2" style={{ marginTop: sub ? 2 : 0 }}>{title}</T></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={10} onPress={() => router.back()} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, backgroundColor: pressed ? c.line2 : c.surface2, alignItems: 'center', justifyContent: 'center' })}><T v="label" style={{ fontSize: 15 }}>✕</T></Pressable>
        </Row>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.s4, paddingBottom: 60, maxWidth: 560, width: '100%', alignSelf: 'center' }}>{children}</ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
