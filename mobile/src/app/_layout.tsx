import { Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, Archivo_700Bold, Archivo_900Black } from '@expo-google-fonts/archivo';
import { ArchivoNarrow_600SemiBold, ArchivoNarrow_700Bold } from '@expo-google-fonts/archivo-narrow';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { checkForUpdate } from '@/components/update-banner';
import { listenResponses, setupChannel, syncReminders } from '@/notifications';
import { loadStore, pull, useApp, useReady } from '@/store/store';
import { useTheme } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();
loadStore();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Archivo_900Black, Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, Archivo_700Bold, ArchivoNarrow_600SemiBold, ArchivoNarrow_700Bold });
  const ready = useReady();
  const { c, dark } = useTheme();
  useEffect(() => { if (fontsLoaded && ready) SplashScreen.hideAsync(); }, [fontsLoaded, ready]);
  useEffect(() => { setupChannel(); return listenResponses(); }, []);
  useEffect(() => { const sub = AppState.addEventListener('change', st => { if (st === 'active') { checkForUpdate(); pull(); } }); return () => sub.remove(); }, []);
  if (!fontsLoaded || !ready) return null;
  const base = dark ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: c.paper, card: c.surface, text: c.ink, border: c.line, primary: c.accent } };
  const sheet = { presentation: 'modal' as const, headerShown: false };
  return (
    <ThemeProvider value={theme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <ReminderSync />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.paper } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="checkin" options={sheet} />
        <Stack.Screen name="activity" options={sheet} />
        <Stack.Screen name="measure" options={sheet} />
        <Stack.Screen name="event" options={sheet} />
        <Stack.Screen name="result/[id]" options={sheet} />
        <Stack.Screen name="run/[date]" options={sheet} />
        <Stack.Screen name="renfo/[date]" options={sheet} />
        <Stack.Screen name="progress/[view]" />
        <Stack.Screen name="strava" options={sheet} />
        <Stack.Screen name="day/[date]" options={sheet} />
        <Stack.Screen name="settings/[section]" />
      </Stack>
    </ThemeProvider>
  );
}

/** Reprogramme les rappels à chaque changement utile (check-in fait, pesée saisie, horaires modifiés). */
function ReminderSync() {
  const s = useApp();
  useEffect(() => { const t = setTimeout(() => syncReminders(s), 800); return () => clearTimeout(t); }, [s]);
  return null;
}
