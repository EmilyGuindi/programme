import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTheme } from '@/theme/tokens';

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <NativeTabs backgroundColor={c.paper} indicatorColor={c.surface2} rippleColor={c.surface2} iconColor={{ default: c.ink3, selected: c.ink }} labelStyle={{ default: { color: c.ink3, fontSize: 11, fontFamily: 'Archivo_500Medium' }, selected: { color: c.ink, fontSize: 11, fontFamily: 'Archivo_600SemiBold' } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Aujourd'hui</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={{ default: require('@/assets/images/tabIcons/today.png'), selected: require('@/assets/images/tabIcons/today-on.png') }} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="program">
        <NativeTabs.Trigger.Label>Programme</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={{ default: require('@/assets/images/tabIcons/program.png'), selected: require('@/assets/images/tabIcons/program-on.png') }} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="progress">
        <NativeTabs.Trigger.Label>Progression</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={{ default: require('@/assets/images/tabIcons/progress.png'), selected: require('@/assets/images/tabIcons/progress-on.png') }} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={{ default: require('@/assets/images/tabIcons/profile.png'), selected: require('@/assets/images/tabIcons/profile-on.png') }} renderingMode="template" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
