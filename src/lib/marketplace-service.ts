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

  // Crée une commande dans marketplace_orders.
  async createOrder(input: OrderInput): Promise<MarketplaceOrder> {
    const payload: TablesInsert<"marketplace_orders"> = {
      user_id: input.userId,
      phone: input.phone,
      neighborhood: input.neighborhood,
      delivery_mode: input.deliveryMode,
      instructions: input.instructions,
      items: input.items,
      total_amount: input.totalAmount,
    };
    const { data, error } = await supabase
      .from("marketplace_orders")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },
};
