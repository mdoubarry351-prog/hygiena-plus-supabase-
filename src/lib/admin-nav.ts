import type { Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export type AdminIcon = keyof typeof Ionicons.glyphMap;
export type AdminSub = { label: string; href: Href; seg: string };
export type AdminTab = { label: string; icon: AdminIcon; href: Href; seg: string; subs?: AdminSub[] };

// Navigation admin : EXACTEMENT 8 onglets. Les anciens écrans deviennent des
// sous-onglets (`subs`) sous le bon onglet — toutes les routes restent accessibles.
export const ADMIN_TABS: AdminTab[] = [
  { label: "Dashboard", icon: "grid-outline", href: "/(admin)/dashboard", seg: "dashboard" },
  {
    label: "Utilisateurs", icon: "people-outline", href: "/(admin)/users", seg: "users",
    subs: [
      { label: "Utilisateurs", href: "/(admin)/users", seg: "users" },
      { label: "Suspensions", href: "/(admin)/suspensions", seg: "suspensions" },
      { label: "Gestion des comptes", href: "/(admin)/accounts", seg: "accounts" },
    ],
  },
  { label: "Médecins", icon: "medkit-outline", href: "/(admin)/doctors", seg: "doctors" },
  {
    label: "Marketplace", icon: "bag-handle-outline", href: "/(admin)/products", seg: "products",
    subs: [
      { label: "Produits", href: "/(admin)/products", seg: "products" },
      { label: "Commandes", href: "/(admin)/orders", seg: "orders" },
      { label: "Avis", href: "/(admin)/reviews", seg: "reviews" },
      { label: "Boutique", href: "/(admin)/store-settings", seg: "store-settings" },
    ],
  },
  {
    label: "Communauté", icon: "chatbubbles-outline", href: "/(admin)/community", seg: "community",
    subs: [
      { label: "Modération", href: "/(admin)/community", seg: "community" },
      { label: "Signalements", href: "/(admin)/reports", seg: "reports" },
      { label: "Mots interdits", href: "/(admin)/banned-words", seg: "banned-words" },
      { label: "Articles", href: "/(admin)/articles", seg: "articles" },
      { label: "Diffusion", href: "/(admin)/broadcast", seg: "broadcast" },
    ],
  },
  { label: "Rendez-vous", icon: "calendar-outline", href: "/(admin)/appointments", seg: "appointments" },
  { label: "Abonnements & Paiements", icon: "card-outline", href: "/(admin)/subscriptions", seg: "subscriptions" },
  {
    label: "Paramètres", icon: "settings-outline", href: "/(admin)/settings", seg: "settings",
    subs: [
      { label: "Services", href: "/(admin)/settings", seg: "settings" },
      { label: "Statistiques", href: "/(admin)/stats", seg: "stats" },
      { label: "Journal d'audit", href: "/(admin)/logs", seg: "logs" },
    ],
  },
];

// Tous les segments couverts par un onglet (principal + sous-onglets).
export function tabSegments(tab: AdminTab): string[] {
  return [tab.seg, ...(tab.subs?.map((s) => s.seg) ?? [])];
}

export function isActiveSeg(pathname: string, seg: string): boolean {
  return pathname === `/${seg}` || pathname.endsWith(`/${seg}`);
}

export function isTabActive(pathname: string, tab: AdminTab): boolean {
  return tabSegments(tab).some((s) => isActiveSeg(pathname, s));
}
