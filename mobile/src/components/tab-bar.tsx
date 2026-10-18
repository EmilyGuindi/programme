import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { font, useTheme } from '@/theme/tokens';
import { GlassSurface } from './glass';
import { Icon, type IconName } from './icons';
import { NAV_H, T } from './ui';

const ICONS: Record<string, IconName> = { index: 'today', program: 'calendar', progress: 'chevrons', profile: 'person' };
const LABELS: Record<string, string> = { index: "Aujourd'hui", program: 'Programme', progress: 'Progression', profile: 'Profil' };

/** Navigation flottante, opaque. 4 destinations libellées ; l'onglet actif : pastille, icône pleine lime, libellé en gras. */
export function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme(); const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 12, alignItems: 'center' }}>
      <GlassSurface r={NAV_H / 2} style={{ width: '92%', maxWidth: 480 }}>
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', height: NAV_H, paddingHorizontal: 6, alignItems: 'center' }}>
          {state.routes.map((route, i) => {
            const on = state.index === i;
            return (
              <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={LABELS[route.name]}
                onPress={() => { const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }); if (!on && !e.defaultPrevented) { Haptics.selectionAsync().catch(() => {}); navigation.navigate(route.name); } }}
                style={({ pressed }) => ({ flex: 1, height: 52, minWidth: 48, marginHorizontal: 2, borderRadius: 26, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: on ? c.surface2 : pressed ? 'rgba(245,247,242,0.06)' : 'transparent' })}>
                <Icon name={ICONS[route.name] || 'today'} size={22} color={on ? c.accent : c.ink2} filled={on} />
                <T v="xs" numberOfLines={1} maxFontSizeMultiplier={1.2} color={on ? c.ink : c.ink2} style={{ fontFamily: on ? font.semibold : font.medium, fontSize: 11, lineHeight: 14 }}>{LABELS[route.name]}</T>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}
