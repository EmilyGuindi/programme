import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTheme } from '@/theme/tokens';

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <NativeTabs backgroundColor={c.surface} indicatorColor={c.accentSoft} labelStyle={{ selected: { color: c.ink } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Aujourd'hui</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={require('@/assets/images/tabIcons/today.png')} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="program">
        <NativeTabs.Trigger.Label>Programme</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={require('@/assets/images/tabIcons/program.png')} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="progress">
        <NativeTabs.Trigger.Label>Progression</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={require('@/assets/images/tabIcons/progress.png')} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={require('@/assets/images/tabIcons/profile.png')} renderingMode="template" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
