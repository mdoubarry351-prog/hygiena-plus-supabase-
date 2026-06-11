import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";

// Seuil « stock bas » (inclut les ruptures à 0).
const LOW_STOCK_THRESHOLD = 5;

export type AdminBadges = {
  pendingDoctors: number; // médecins en attente de validation
  pendingReports: number; // signalements en attente
  pendingOrders: number; // commandes en attente
  lowOrOutOfStock: number; // produits stock bas ou rupture
};

const ZERO: AdminBadges = { pendingDoctors: 0, pendingReports: 0, pendingOrders: 0, lowOrOutOfStock: 0 };

/**
 * Compteurs « à traiter » pour le menu admin. Quelques requêtes `count`
 * légères (head:true), rafraîchies au focus. Pas de polling.
 */
export function useAdminBadges(): AdminBadges & { reload: () => Promise<void> } {
  const [badges, setBadges] = useState<AdminBadges>(ZERO);

  const reload = useCallback(async () => {
    try {
      const [doctorsRes, reportsRes, ordersRes, stockRes] = await Promise.all([
        supabase.from("doctors").select("id", { count: "exact", head: true }).eq("is_validated", false),
        supabase.from("user_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("marketplace_orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("marketplace_products").select("id", { count: "exact", head: true }).lte("stock", LOW_STOCK_THRESHOLD),
      ]);
      setBadges({
        pendingDoctors: doctorsRes.count ?? 0,
        pendingReports: reportsRes.count ?? 0,
        pendingOrders: ordersRes.count ?? 0,
        lowOrOutOfStock: stockRes.count ?? 0,
      });
    } catch {
      // En cas d'erreur, on conserve les dernières valeurs connues.
    }
  }, []);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  return { ...badges, reload };
}

/** Compteur « à traiter » associé à un segment de route admin (0 = pas de badge). */
export function badgeForSeg(seg: string, b: AdminBadges): number {
  switch (seg) {
    case "doctors":
      return b.pendingDoctors;
    case "reports":
      return b.pendingReports;
    case "orders":
      return b.pendingOrders;
    case "products":
      return b.lowOrOutOfStock;
    default:
      return 0;
  }
}
