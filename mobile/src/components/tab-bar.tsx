import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { haptic, useReducedMotion } from '@/feedback';
import { font, useTheme } from '@/theme/tokens';
import { NAV } from '@/theme/nav-layout';
import { Icon, type IconName } from './icons';
import { useNavLayout } from './ui';

const ICONS: Record<string, IconName> = { index: 'home', program: 'plan', progress: 'stats', profile: 'profile' };
const LABELS: Record<string, string> = { index: "Aujourd'hui", program: 'Programme', progress: 'Progression', profile: 'Profil' };
const BAR_W = 20; // trait lime de l'onglet actif

/** Navigation principale. Quatre colonnes égales, sans forme autour de l'onglet actif :
 *  icône pleine en lime posée sur un halo diffus, libellé clair, et un trait lime qui glisse le long du bord haut de la barre.
 *  La taille des libellés est calculée (nav-layout) : ils tiennent toujours dans leur colonne, sans troncature ni masquage.
 *  Un socle opaque couvre tout l'espace sous la barre, zone système comprise. */
export function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme(); const L = useNavLayout(); const reduced = useReducedMotion();
  const x = useRef(new Animated.Value(state.index)).current;
  useEffect(() => {
    if (reduced) x.setValue(state.index);
    else Animated.spring(x, { toValue: state.index, friction: 9, tension: 90, useNativeDriver: true }).start();
  }, [state.index, reduced]);
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: L.dockH, backgroundColor: c.paper, alignItems: 'center', paddingTop: NAV.dockTop }}>
      {/* Fondu au-dessus du socle : le contenu disparaît avant d'atteindre la barre. */}
      <Svg pointerEvents="none" width="100%" height={20} style={{ position: 'absolute', top: -20, left: 0 }}>
        <Defs><LinearGradient id="navfade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={c.paper} stopOpacity={0} /><Stop offset="1" stopColor={c.paper} stopOpacity={1} /></LinearGradient></Defs>
        <Rect width="100%" height={20} fill="url(#navfade)" />
      </Svg>
      <View accessibilityRole="tablist" style={{ width: L.barW, height: L.barH, flexDirection: 'row', borderRadius: 28, backgroundColor: c.nav, borderWidth: 1, borderColor: c.line2, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 14 }}>
        {/* Trait de sélection : centré sur la colonne active, il glisse d'un onglet à l'autre. */}
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -1, left: 0, width: BAR_W, height: 3, borderRadius: 2, backgroundColor: c.accent,
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [L.colW / 2 - BAR_W / 2, L.colW * 1.5 - BAR_W / 2] }) }] }} />
        {state.routes.map((route, i) => {
          const on = state.index === i; const label = LABELS[route.name] ?? route.name;
          return (
            <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: on }} aria-selected={on} accessibilityLabel={label}
              onPress={() => { const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }); if (!on && !e.defaultPrevented) { haptic('select'); navigation.navigate(route.name); } }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={{ width: L.colW, height: L.barH, alignItems: 'center', justifyContent: 'center' }}>
              {({ pressed }) => (<>
                <View style={{ width: NAV.pillW, height: NAV.pillH, alignItems: 'center', justifyContent: 'center', opacity: pressed && !on ? 0.6 : 1 }}>
                  {/* Halo : un dégradé radial sans contour, pas une forme */}
                  {on ? <Svg pointerEvents="none" width={NAV.pillW} height={NAV.pillH + 12} style={{ position: 'absolute', top: -6 }}>
                    <Defs><RadialGradient id={`halo${i}`} cx="50%" cy="50%" rx="50%" ry="50%"><Stop offset="0" stopColor={c.accent} stopOpacity={0.28} /><Stop offset="1" stopColor={c.accent} stopOpacity={0} /></RadialGradient></Defs>
                    <Rect width={NAV.pillW} height={NAV.pillH + 12} fill={`url(#halo${i})`} />
                  </Svg> : null}
                  <Icon name={ICONS[route.name] || 'home'} size={NAV.icon} color={on ? c.accent : c.ink2} filled={on} cut={c.nav} />
                </View>
                <Text allowFontScaling={false} style={{ marginTop: NAV.gapIconLabel, fontFamily: on ? font.semibold : font.medium, fontSize: L.label, lineHeight: L.lineH, color: on ? c.ink : c.ink2, textAlign: 'center' }}>{label}</Text>
              </>)}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
