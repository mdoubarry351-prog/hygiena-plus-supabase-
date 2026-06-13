import type { MarketplaceOrder, OrderStatus } from "@/lib/database.types";
import type { OrderItem } from "@/lib/marketplace-service";
import { colors } from "@/theme";

// Libellés et couleurs des statuts de commande (partagés liste/détail).
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  preparing: "En préparation",
  delivering: "Expédiée",
  completed: "Livrée",
  cancelled: "Annulée",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: colors.accent,
  confirmed: colors.secondary,
  preparing: colors.secondary,
  delivering: colors.primary,
  completed: colors.success,
  cancelled: colors.danger,
};

export const PAYMENT_LABELS: Record<string, string> = {
  orange_money: "Orange Money",
  mtn: "MTN Money",
  cod: "Paiement à la livraison",
  whatsapp: "WhatsApp",
};

// Articles d'une commande (jsonb) typés.
export function orderItems(items: MarketplaceOrder["items"]): OrderItem[] {
  return Array.isArray(items) ? (items as unknown as OrderItem[]) : [];
}

export function orderItemCount(items: MarketplaceOrder["items"]): number {
  return orderItems(items).reduce((s, it) => s + (it?.quantity ?? 0), 0);
}

// Sous-total = somme des articles ; la livraison se déduit (total - sous-total).
export function orderSubtotal(items: MarketplaceOrder["items"]): number {
  return orderItems(items).reduce((s, it) => s + (it?.price ?? 0) * (it?.quantity ?? 0), 0);
}

export function formatOrderDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
