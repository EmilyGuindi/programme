import Tabs from 'expo-router/js-tabs';
import { GlassTabBar } from '@/components/tab-bar';
import { useTheme } from '@/theme/tokens';

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs tabBar={props => <GlassTabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.paper }, animation: 'fade' }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="program" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
