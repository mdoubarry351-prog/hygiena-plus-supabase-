import { supabase } from "@/lib/supabase";
import type { MarketplaceProduct, MarketplaceOrder, TablesInsert } from "@/lib/database.types";

// Article tel qu'enregistré dans la colonne jsonb "items" d'une commande.
export type OrderItem = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
};

// Données saisies par l'utilisatrice lors du passage de commande.
export type OrderInput = {
  userId: string;
  phone: string;
  neighborhood: string | null;
  deliveryMode: "delivery" | "pickup";
  instructions: string | null;
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: string | null;
  paymentPhone: string | null;
  isPaid: boolean;
};

// Réglages de paiement boutique utiles au checkout (lecture best-effort :
// si la RLS bloque la lecture côté utilisatrice, on renvoie null).
export type StorePaymentSettings = {
  cod_enabled: boolean;
  cod_max_amount: number | null;
  whatsapp_enabled: boolean;
  whatsapp_number: string | null;
};

// Formatage prix en francs guinéens, ex. "50 000GNF".
export function formatPrice(amount: number): string {
  return `${Math.round(amount).toLocaleString("fr-FR")}GNF`;
}

export const marketplaceService = {
  // Produits actifs uniquement, les plus récents en premier.
  async getProducts(): Promise<MarketplaceProduct[]> {
    const { data, error } = await supabase
      .from("marketplace_products")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  // Produits actifs paginés (.range), même ordre/filtre que getProducts.
  async getProductsPage(opts?: { limit?: number; offset?: number }): Promise<MarketplaceProduct[]> {
    const limit = opts?.limit ?? 20;
    const offset = opts?.offset ?? 0;
    const { data, error } = await supabase
      .from("marketplace_products")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data ?? [];
  },

  // Détail d'un produit (actif uniquement).
  async getProduct(id: string): Promise<MarketplaceProduct | null> {
    const { data, error } = await supabase
      .from("marketplace_products")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .single();
    if (error) throw error;
    return data;
  },

  // Historique des commandes de l'utilisateur, les plus récentes en premier.
  async getOrders(userId: string): Promise<MarketplaceOrder[]> {
    const { data, error } = await supabase
      .from("marketplace_orders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  // Crée une commande dans marketplace_orders (avec infos de paiement).
  async createOrder(input: OrderInput): Promise<MarketplaceOrder> {
    const payload: TablesInsert<"marketplace_orders"> = {
      user_id: input.userId,
      phone: input.phone,
      neighborhood: input.neighborhood,
      delivery_mode: input.deliveryMode,
      instructions: input.instructions,
      items: input.items,
      total_amount: input.totalAmount,
      payment_method: input.paymentMethod,
      payment_phone: input.paymentPhone,
      is_paid: input.isPaid,
      paid_at: input.isPaid ? new Date().toISOString() : null,
    };
    const { data, error } = await supabase
      .from("marketplace_orders")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  // Réglages de paiement boutique (best-effort ; null si non lisible/absent).
  async getStorePaymentSettings(): Promise<StorePaymentSettings | null> {
    try {
      const { data, error } = await supabase
        .from("store_settings")
        .select("cod_enabled, cod_max_amount, whatsapp_enabled, whatsapp_number")
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return data;
    } catch {
      return null;
    }
  },
};
