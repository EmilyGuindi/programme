import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { font, useTheme } from '@/theme/tokens';
import { GlassSurface } from './glass';
import { Icon, type IconName } from './icons';
import { T } from './ui';

const ICONS: Record<string, IconName> = { index: 'today', program: 'calendar', progress: 'chevrons', profile: 'person' };
const LABELS: Record<string, string> = { index: "Aujourd'hui", program: 'Programme', progress: 'Progression', profile: 'Profil' };

/** Navigation flottante en verre : 4 destinations, libellées, état actif en lime. */
export function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme(); const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, 10) + 4, alignItems: 'center' }}>
      <GlassSurface r={28} style={{ width: '92%', maxWidth: 520 }}>
        <View style={{ flexDirection: 'row', paddingHorizontal: 6, paddingVertical: 6 }}>
          {state.routes.map((route, i) => {
            const on = state.index === i;
            return (
              <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={LABELS[route.name]}
                onPress={() => { const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }); if (!on && !e.defaultPrevented) { Haptics.selectionAsync().catch(() => {}); navigation.navigate(route.name); } }}
                style={({ pressed }) => ({ flex: 1, height: 52, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: on ? c.accentSoft : pressed ? 'rgba(245,247,242,0.05)' : 'transparent' })}>
                <Icon name={ICONS[route.name] || 'today'} size={22} color={on ? c.accent : c.ink3} filled={on} />
                <T v="xs" color={on ? c.ink : c.ink3} style={{ fontFamily: on ? font.semibold : font.medium, fontSize: 11, lineHeight: 13 }}>{LABELS[route.name]}</T>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}
