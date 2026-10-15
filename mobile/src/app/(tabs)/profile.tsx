import { router } from 'expo-router';
import type { ComponentType } from 'react';
import { Pressable, View } from 'react-native';
import { APP_VERSION } from '@/changelog';
import { IlluBell, IlluConnect, IlluCycle, IlluData, IlluGoals, IlluNews } from '@/components/illustrations';
import { Wordmark } from '@/components/logo';
import { Screen, T } from '@/components/ui';
import { radius, space, useTheme } from '@/theme/tokens';

const TILES: { section: string; title: string; sub: string; Illu: ComponentType<{ size?: number }> }[] = [
  { section: 'goals', title: 'Objectifs', sub: 'Ce que je vise', Illu: IlluGoals },
  { section: 'reminders', title: 'Rappels', sub: 'Check-in et pesée', Illu: IlluBell },
  { section: 'connections', title: 'Connexions', sub: 'Serveur et Strava', Illu: IlluConnect },
  { section: 'program', title: 'Programme', sub: 'Mon cycle en cours', Illu: IlluCycle },
  { section: 'data', title: 'Mes données', sub: 'Sauvegarde et réglages', Illu: IlluData },
  { section: 'news', title: 'Quoi de neuf', sub: 'Dernières nouveautés', Illu: IlluNews },
];

export default function Profile() {
  const { c } = useTheme();
  return (
    <Screen>
      <T v="title" style={{ paddingTop: space.s4 }}>Profil</T>
      <T muted style={{ marginBottom: space.s4 }}>Touche une carte pour l'ouvrir.</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s3 }}>
        {TILES.map(({ section, title, sub, Illu }) => (
          <Pressable key={section} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`}
            onPress={() => router.push({ pathname: '/settings/[section]', params: { section } })}
            style={({ pressed }) => ({ flexBasis: '47%', flexGrow: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.r2, padding: space.s4, gap: space.s3, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
            <View style={{ backgroundColor: c.accentSoft, borderRadius: radius.r2, alignItems: 'center', justifyContent: 'center', paddingVertical: space.s4 }}><Illu size={64} /></View>
            <View><T v="label">{title}</T><T v="small" muted>{sub}</T></View>
          </Pressable>
        ))}
      </View>
      <View style={{ alignItems: 'center', marginTop: space.s6, gap: 8 }}><Wordmark height={14} tagline /><T v="xs" muted>{`Version ${APP_VERSION}`}</T></View>
    </Screen>
  );
}
