import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

// =====================================================
// Enveloppe SÛRE autour d'expo-notifications.
// - Notifications LOCALES planifiées (aucun push serveur).
// - Tout est try/catch + gardé par Device.isDevice : ne crashe JAMAIS
//   (simulateur, Expo Go, permission refusée → no-op silencieux).
// - Limite connue : dans Expo Go (SDK 53+), les notifications distantes ne
//   sont plus supportées et les notifications locales iOS sont limitées. Le
//   code reste correct pour un build de développement/production.
// =====================================================

const ANDROID_CHANNEL = "reminders";

// Expo Go : utile pour le diagnostic / message à l'utilisateur.
export const isExpoGo = Constants.appOwnership === "expo";

export type PermStatus = "granted" | "denied" | "undetermined" | "unavailable";

// Les notifications réelles ne fonctionnent que sur un appareil physique.
export function notificationsSupported(): boolean {
  return Device.isDevice;
}

let handlerSet = false;
// À appeler une fois au démarrage : affiche bannière + son quand une notif arrive
// alors que l'app est au premier plan.
export function setupNotificationHandler(): void {
  if (handlerSet) return;
  handlerSet = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // expo-notifications indisponible : on ignore.
  }
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: "Rappels",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });
  } catch {
    // best-effort
  }
}

export async function getPermissionStatus(): Promise<PermStatus> {
  if (!Device.isDevice) return "unavailable";
  try {
    const s = await Notifications.getPermissionsAsync();
    if (s.granted) return "granted";
    if (s.status === "undetermined" || s.canAskAgain) return "undetermined";
    return "denied";
  } catch {
    return "unavailable";
  }
}

// Demande la permission (crée le canal Android au passage). Renvoie true si accordée.
export async function requestPermission(): Promise<boolean> {
  if (!Device.isDevice) return false;
  try {
    await ensureAndroidChannel();
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    if (!existing.canAskAgain && existing.status !== "undetermined") return false;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

export type ReminderContent = { title: string; body: string };

// Planifie une notification unique à une date précise. Ignore si la date est
// passée (ou trop proche), si non supporté, ou en cas d'erreur.
export async function scheduleAt(when: Date, content: ReminderContent, kind: string): Promise<void> {
  if (!Device.isDevice) return;
  const ts = when.getTime();
  if (Number.isNaN(ts) || ts <= Date.now() + 60_000) return; // au moins 1 min dans le futur
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: content.title, body: content.body, sound: true, data: { kind } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: ANDROID_CHANNEL,
      },
    });
  } catch {
    // best-effort
  }
}

// Annule toutes les notifications planifiées dont `data.kind` commence par `prefix`.
// Permet de replanifier proprement une catégorie (ex. tous les rappels cycle).
export async function cancelByKindPrefix(prefix: string): Promise<void> {
  if (!Device.isDevice) return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((n) => {
          const k = (n.content?.data as { kind?: string } | undefined)?.kind;
          return typeof k === "string" && k.startsWith(prefix);
        })
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
    );
  } catch {
    // best-effort
  }
}
