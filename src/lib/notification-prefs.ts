import AsyncStorage from "@react-native-async-storage/async-storage";

// Préférences de notifications, stockées EN LOCAL (AsyncStorage) — aucun backend.
export type NotifPrefs = Record<string, boolean>;

// Définition des préférences (clé locale + libellé + types de notif. concernés).
export const NOTIF_PREF_DEFS: { key: string; label: string; sub: string; icon: string; types: string[] }[] = [
  { key: "period_soon", label: "Règles à venir", sub: "Approche de vos prochaines règles", icon: "water-outline", types: ["cycle_period_soon"] },
  { key: "fertile", label: "Fenêtre fertile", sub: "Début de votre fenêtre fertile", icon: "leaf-outline", types: ["cycle_fertile"] },
  { key: "ovulation", label: "Ovulation", sub: "Jour d'ovulation estimé", icon: "ellipse-outline", types: ["cycle_ovulation"] },
  { key: "period_late", label: "Retard de règles", sub: "Règles attendues non enregistrées", icon: "alert-circle-outline", types: ["cycle_period_late"] },
  { key: "log_reminder", label: "Rappel de saisie", sub: "Penser à enregistrer votre suivi", icon: "create-outline", types: ["cycle_log_daily"] },
  { key: "appointments", label: "Rendez-vous", sub: "Rappels de rendez-vous", icon: "calendar-outline", types: ["appointment_reminder"] },
  { key: "doctor_messages", label: "Messages du médecin", sub: "Nouvelles réponses des médecins", icon: "chatbubbles-outline", types: ["doctor_message"] },
];

const STORAGE_KEY = "notif_prefs";

// Toutes les préférences activées par défaut.
export function defaultPrefs(): NotifPrefs {
  const p: NotifPrefs = {};
  for (const d of NOTIF_PREF_DEFS) p[d.key] = true;
  return p;
}

export async function loadNotifPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPrefs();
    const parsed = JSON.parse(raw) as NotifPrefs;
    return { ...defaultPrefs(), ...parsed };
  } catch {
    return defaultPrefs();
  }
}

export async function saveNotifPrefs(prefs: NotifPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // best-effort : pas bloquant
  }
}

// Type de notification → clé de préférence (les types non mappés restent visibles).
const TYPE_TO_PREF: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const d of NOTIF_PREF_DEFS) for (const t of d.types) m[t] = d.key;
  return m;
})();

// Une notification doit-elle s'afficher selon les préférences ?
// Un type non mappé reste visible par défaut.
export function isNotifEnabled(prefs: NotifPrefs, type: string | null): boolean {
  if (!type) return true;
  const key = TYPE_TO_PREF[type];
  if (!key) return true;
  return prefs[key] !== false;
}
