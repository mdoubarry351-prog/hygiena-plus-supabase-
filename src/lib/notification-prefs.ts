import AsyncStorage from "@react-native-async-storage/async-storage";
import { PREMIUM_ENABLED } from "@/lib/app-config";

// Préférences de notifications, stockées EN LOCAL (AsyncStorage) — aucun backend.
export type NotifPrefs = Record<string, boolean>;

// Tous les groupes de préférences indépendants, chacun mappé à un/plusieurs `type`.
const ALL_NOTIF_PREF_DEFS: { key: string; label: string; sub: string; icon: string; types: string[] }[] = [
  { key: "period", label: "Rappels de règles", sub: "Approche, retard et rappel de saisie", icon: "water-outline", types: ["cycle_period_soon", "cycle_period_late", "cycle_log_daily"] },
  { key: "ovulation", label: "Rappels d'ovulation", sub: "Ovulation et fenêtre fertile", icon: "ellipse-outline", types: ["cycle_ovulation", "cycle_fertile"] },
  { key: "appointments", label: "Rappels de rendez-vous", sub: "Demandes, statuts et rappels", icon: "calendar-outline", types: ["appointment_new", "appointment_status", "appointment_reminder"] },
  { key: "community", label: "Notifications communautaires", sub: "Commentaires, réponses et réactions", icon: "people-outline", types: ["community_comment", "community_reply", "community_like"] },
  { key: "doctor_messages", label: "Messages des médecins", sub: "Réponses des médecins en messagerie", icon: "chatbubbles-outline", types: ["doctor_message"] },
  { key: "marketplace", label: "Notifications Marketplace", sub: "Suivi de vos commandes", icon: "bag-handle-outline", types: ["order_status"] },
  { key: "premium", label: "Notifications Premium", sub: "Paiements et expiration d'abonnement", icon: "star-outline", types: ["premium_payment", "premium_expiring"] },
  { key: "system", label: "Notifications système", sub: "Annonces et messages généraux", icon: "megaphone-outline", types: ["admin_broadcast", "general"] },
];

// Groupe Premium retiré de l'UI tant que le Premium est désactivé (réversible).
// Le mapping type→préférence reste exhaustif via ALL_NOTIF_PREF_DEFS (inoffensif).
export const NOTIF_PREF_DEFS = PREMIUM_ENABLED
  ? ALL_NOTIF_PREF_DEFS
  : ALL_NOTIF_PREF_DEFS.filter((d) => d.key !== "premium");

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
  for (const d of ALL_NOTIF_PREF_DEFS) for (const t of d.types) m[t] = d.key;
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
