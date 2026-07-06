import { supabase } from "@/lib/supabase";
import type { SubscriptionPayment } from "@/lib/database.types";

// Abonnement Premium (paiement SIMULÉ) : prix mensuel + durée de période.
export const PREMIUM_PRICE = 50000; // GNF
export const PREMIUM_PERIOD_DAYS = 30;

export const premiumService = {
  // Historique des paiements d'abonnement de l'utilisatrice (plus récents d'abord).
  async getSubscriptionPayments(userId: string): Promise<SubscriptionPayment[]> {
    const { data, error } = await supabase
      .from("subscription_payments")
      .select("*")
      .eq("user_id", userId)
      .order("paid_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  // Active / désactive l'abonnement Premium via l'Edge Function de confiance
  // `premium-subscribe`. La cliente ne peut PLUS écrire profiles.is_premium ni
  // subscription_payments directement (bloqué par RLS + triggers, P0-1) : seul
  // le serveur accorde Premium (après vérification du paiement, simulée pour
  // l'instant) et écrit l'historique des paiements.
  async setPremium(action: "subscribe" | "unsubscribe"): Promise<void> {
    const { data, error } = await supabase.functions.invoke("premium-subscribe", {
      body: { action },
    });
    if (error) {
      let message = error.message || "Action Premium échouée";
      try {
        const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
        const body = ctx?.json ? ((await ctx.json()) as { error?: string }) : null;
        if (body?.error) message = body.error;
      } catch {
        // message par défaut conservé
      }
      throw new Error(message);
    }
    const body = data as { success?: boolean; error?: string } | null;
    if (body?.error) throw new Error(body.error);
  },
};
