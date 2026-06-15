import { supabase } from "@/lib/supabase";
import type { SubscriptionPayment, TablesInsert } from "@/lib/database.types";

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

  // Enregistre un paiement d'abonnement (paiement simulé — aucune transaction réelle).
  async recordSubscriptionPayment(input: {
    userId: string;
    amount: number;
    method?: string | null;
    plan?: string | null;
    periodStart?: string | null;
    periodEnd?: string | null;
  }): Promise<SubscriptionPayment> {
    const payload: TablesInsert<"subscription_payments"> = {
      user_id: input.userId,
      amount: input.amount,
      method: input.method ?? null,
      plan: input.plan ?? null,
      period_start: input.periodStart ?? null,
      period_end: input.periodEnd ?? null,
      paid_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("subscription_payments")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },
};
