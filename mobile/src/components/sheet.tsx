import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { space, useTheme } from '@/theme/tokens';
import { Button, Row, T } from './ui';

export function Sheet({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Row between style={{ paddingHorizontal: space.s4, paddingVertical: space.s3, borderBottomWidth: 1, borderBottomColor: c.line }}>
          <View style={{ flex: 1 }}><T v="h2">{title}</T>{sub ? <T v="small" muted>{sub}</T> : null}</View>
          <Button small label="Fermer" onPress={() => router.back()} />
        </Row>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.s4, paddingBottom: 60, maxWidth: 560, width: '100%', alignSelf: 'center' }}>{children}</ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
