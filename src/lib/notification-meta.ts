import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme";

type Icon = keyof typeof Ionicons.glyphMap;

// =====================================================
// Catégories de notifications (segmentation / filtre de l'écran)
// =====================================================
export type NotifCategoryKey = "cycle" | "appointments" | "doctor" | "community" | "marketplace" | "system";

export const NOTIF_CATEGORIES: { key: NotifCategoryKey; label: string; icon: Icon }[] = [
  { key: "cycle", label: "Cycle", icon: "water-outline" },
  { key: "appointments", label: "Rendez-vous", icon: "calendar-outline" },
  { key: "doctor", label: "Messages médecins", icon: "chatbubbles-outline" },
  { key: "community", label: "Communauté", icon: "people-outline" },
  { key: "marketplace", label: "Marketplace", icon: "bag-handle-outline" },
  { key: "system", label: "Système", icon: "megaphone-outline" },
];

const CATEGORY_LABELS: Record<NotifCategoryKey, string> =
  Object.fromEntries(NOTIF_CATEGORIES.map((c) => [c.key, c.label])) as Record<NotifCategoryKey, string>;

export function categoryLabel(key: NotifCategoryKey): string {
  return CATEGORY_LABELS[key];
}

// Type de notification → catégorie (les types inconnus tombent dans « system »).
const TYPE_TO_CATEGORY: Record<string, NotifCategoryKey> = {
  cycle_period_soon: "cycle",
  cycle_period_late: "cycle",
  cycle_fertile: "cycle",
  cycle_ovulation: "cycle",
  cycle_log_daily: "cycle",
  appointment_new: "appointments",
  appointment_status: "appointments",
  appointment_reminder: "appointments",
  doctor_message: "doctor",
  community_comment: "community",
  community_reply: "community",
  community_like: "community",
  order_status: "marketplace",
  admin_broadcast: "system",
  general: "system",
};

export function categoryOf(type: string | null): NotifCategoryKey {
  return (type && TYPE_TO_CATEGORY[type]) || "system";
}

// =====================================================
// Icône + couleur par TYPE (pastille de chaque ligne)
// =====================================================
export type NotifTypeMeta = { icon: Icon; color: string };

const TYPE_META: Record<string, NotifTypeMeta> = {
  cycle_period_soon: { icon: "water", color: colors.danger },
  cycle_period_late: { icon: "alert-circle", color: colors.danger },
  cycle_fertile: { icon: "leaf", color: colors.primary },
  cycle_ovulation: { icon: "ellipse", color: colors.secondary },
  cycle_log_daily: { icon: "create", color: colors.primary },
  appointment_new: { icon: "medkit", color: colors.secondary },
  appointment_status: { icon: "calendar", color: colors.primary },
  appointment_reminder: { icon: "alarm", color: colors.secondary },
  doctor_message: { icon: "chatbubbles", color: colors.primary },
  community_comment: { icon: "chatbubble", color: colors.primary },
  community_reply: { icon: "arrow-undo", color: colors.primary },
  community_like: { icon: "heart", color: colors.danger },
  order_status: { icon: "cube", color: colors.primary },
  admin_broadcast: { icon: "megaphone", color: colors.primary },
  general: { icon: "notifications", color: colors.primary },
};

const DEFAULT_TYPE_META: NotifTypeMeta = { icon: "notifications", color: colors.primary };

export function typeMeta(type: string | null): NotifTypeMeta {
  return (type && TYPE_META[type]) || DEFAULT_TYPE_META;
}
