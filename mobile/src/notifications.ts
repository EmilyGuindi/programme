import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { planReminders } from '@/engine/reminders';
import type { AppState } from '@/engine/types';

const CHANNEL = 'rappels';
let lastSig = '';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function setupChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Rappels BYYND', importance: Notifications.AndroidImportance.HIGH, lightColor: '#0047FF', vibrationPattern: [0, 200, 120, 200] }).catch(() => {});
}
export async function permission(): Promise<'granted' | 'denied' | 'undetermined'> {
  try { const p = await Notifications.getPermissionsAsync(); return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied'; } catch { return 'denied'; }
}
export async function askPermission() {
  await setupChannel();
  const p = await Notifications.requestPermissionsAsync();
  return p.granted;
}

/** Reprogramme les rappels locaux : fonctionnent téléphone verrouillé et app fermée, sans serveur. */
export async function syncReminders(s: AppState, force = false) {
  try {
    if ((await permission()) !== 'granted') return;
    const list = planReminders(s);
    const sig = JSON.stringify([list.map(r => r.id + r.at.getTime()), s.user.prefs]);
    if (!force && sig === lastSig) return;
    lastSig = sig;
    await setupChannel();
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const r of list) {
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body, data: { url: r.url }, color: '#0047FF' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL },
      });
    }
  } catch {}
}
export async function nextScheduled(): Promise<Date | null> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const ts = all.map(n => (n.trigger as any)?.value ?? (n.trigger as any)?.date).filter(Boolean).map((v: any) => new Date(v).getTime()).filter(t => t > Date.now());
    return ts.length ? new Date(Math.min(...ts)) : null;
  } catch { return null; }
}
export async function testNotification() {
  await setupChannel();
  await Notifications.scheduleNotificationAsync({ content: { title: 'Comment tu te sens ce matin ?', body: 'Ceci est un test : touche-moi pour ouvrir le check-in.', data: { url: '/checkin' }, color: '#0047FF' }, trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL } });
}

/** Ouvre l'écran ciblé quand on touche une notification (app ouverte, en arrière-plan ou fermée). */
export function listenResponses() {
  const go = (r: Notifications.NotificationResponse | null) => { const url = r?.notification.request.content.data?.url; if (typeof url === 'string') setTimeout(() => router.push(url as any), 300); };
  Notifications.getLastNotificationResponseAsync().then(go).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(go);
  return () => sub.remove();
}
