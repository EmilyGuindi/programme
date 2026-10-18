import { Pressable, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { haptic } from '@/feedback';
import { font, useTheme } from '@/theme/tokens';
import { NAV } from '@/theme/nav-layout';
import { Icon, type IconName } from './icons';
import { useNavLayout } from './ui';

const ICONS: Record<string, IconName> = { index: 'home', program: 'plan', progress: 'stats', profile: 'profile' };
const LABELS: Record<string, string> = { index: "Aujourd'hui", program: 'Programme', progress: 'Progression', profile: 'Profil' };

/** Navigation principale. Quatre colonnes égales ; l'onglet actif = pastille lime derrière l'icône (jamais autour du libellé),
 *  icône pleine, libellé clair. La taille des libellés est calculée (nav-layout) : ils tiennent toujours dans leur colonne,
 *  sans troncature ni masquage. Un socle opaque couvre tout l'espace sous la barre, zone système comprise. */
export function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme(); const L = useNavLayout();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: L.dockH, backgroundColor: c.paper, alignItems: 'center', paddingTop: NAV.dockTop }}>
      {/* Fondu au-dessus du socle : le contenu disparaît avant d'atteindre la barre. */}
      <Svg pointerEvents="none" width="100%" height={20} style={{ position: 'absolute', top: -20, left: 0 }}>
        <Defs><LinearGradient id="navfade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={c.paper} stopOpacity={0} /><Stop offset="1" stopColor={c.paper} stopOpacity={1} /></LinearGradient></Defs>
        <Rect width="100%" height={20} fill="url(#navfade)" />
      </Svg>
      <View accessibilityRole="tablist" style={{ width: L.barW, height: L.barH, flexDirection: 'row', borderRadius: 28, backgroundColor: c.nav, borderWidth: 1, borderColor: c.line2, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 14 }}>
        {state.routes.map((route, i) => {
          const on = state.index === i; const label = LABELS[route.name] ?? route.name;
          return (
            <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: on }} aria-selected={on} accessibilityLabel={label}
              onPress={() => { const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }); if (!on && !e.defaultPrevented) { haptic('select'); navigation.navigate(route.name); } }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={{ width: L.colW, height: L.barH, alignItems: 'center', justifyContent: 'center' }}>
              {({ pressed }) => (<>
                <View style={{ width: NAV.pillW, height: NAV.pillH, borderRadius: NAV.pillH / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.accent : pressed ? c.surface2 : 'transparent' }}>
                  <Icon name={ICONS[route.name] || 'home'} size={NAV.icon} color={on ? c.accentInk : c.ink2} filled={on} cut={c.accent} />
                </View>
                <Text allowFontScaling={false} style={{ marginTop: NAV.gapIconLabel, fontFamily: font.medium, fontSize: L.label, lineHeight: L.lineH, color: on ? c.ink : c.ink2, textAlign: 'center' }}>{label}</Text>
              </>)}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
