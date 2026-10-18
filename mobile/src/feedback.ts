import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { getState, useApp } from '@/store/store';

/** Retours haptiques BYYND : un seul point d'entrée, qui respecte le réglage Profil → Mes données → Retours et animations. */
export type HapticKind = 'select' | 'tick' | 'untick' | 'success' | 'warning';
export function haptic(kind: HapticKind) {
  if (getState().user.prefs.haptics === false) return;
  const p = kind === 'select' ? Haptics.selectionAsync()
    : kind === 'tick' ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    : kind === 'untick' ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    : Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
  p.catch(() => {});
}

let systemReduced = false;
AccessibilityInfo.isReduceMotionEnabled().then(r => { systemReduced = r; }).catch(() => {});
AccessibilityInfo.addEventListener?.('reduceMotionChanged', r => { systemReduced = r; });

/** Animations réduites : réglage système Android OU préférence BYYND. */
export const reducedMotion = () => systemReduced || getState().user.prefs.motion === 'reduced';
export function useReducedMotion() {
  const pref = useApp(s => s.user.prefs.motion);
  const [sys, setSys] = useState(systemReduced);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setSys).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setSys);
    return () => sub?.remove?.();
  }, []);
  return sys || pref === 'reduced';
}
