import { supabase } from "@/lib/supabase";
import type { MarketplaceProduct, MarketplaceOrder, TablesInsert, Json, OrderEvent } from "@/lib/database.types";

// Catégories de produits (liste fixe, FR). Centralisée : réutilisée par la
// boutique (filtres) et le formulaire admin (select).
export const PRODUCT_CATEGORIES = [
  "Protections",
  "Hygiène intime",
  "Bien-être",
  "Nutrition",
  "Soins",
  "Autre",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

// Tris disponibles côté boutique.
export type ProductSort = "recent" | "price_asc" | "price_desc" | "rating";

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
};

// Réglages de paiement + livraison boutique utiles au checkout (lecture best-effort :
// si la RLS bloque la lecture côté utilisatrice, on renvoie null).
export type StorePaymentSettings = {
  cod_enabled: boolean;
  cod_max_amount: number | null;
  cod_zones: string[] | null;
  whatsapp_enabled: boolean;
  whatsapp_number: string | null;
  default_delivery_fee: number;
  free_delivery_threshold: number | null;
  delivery_zones: Json | null;
};

// Formatage prix en francs guinéens, ex. "50 000GNF".
export function formatPrice(amount: number): string {
  return `${Math.round(amount).toLocaleString("fr-FR")}GNF`;
}

// Frais de zone pour un quartier donné, depuis delivery_zones (jsonb).
// Accepte un tableau [{ name, fee }] ou un objet { "Quartier": fee }.
function zoneFeeFor(zones: Json | null | undefined, neighborhood: string): number | null {
  const q = neighborhood.trim().toLowerCase();
  if (!zones || !q) return null;
  if (Array.isArray(zones)) {
    for (const z of zones) {
      if (z && typeof z === "object" && !Array.isArray(z)) {
        const rec = z as Record<string, unknown>;
        const name = String(rec.name ?? "").trim().toLowerCase();
        const fee = Number(rec.fee);
        if (name === q && Number.isFinite(fee)) return fee;
      }
    }
    return null;
  }
  if (typeof zones === "object") {
    for (const [k, v] of Object.entries(zones as Record<string, unknown>)) {
      if (k.trim().toLowerCase() === q) {
        const fee = Number(v);
        if (Number.isFinite(fee)) return fee;
      }
    }
  }
  return null;
}

// Calcule les frais de livraison : retrait = 0 ; seuil de gratuité atteint = 0 ;
// sinon frais de la zone du quartier, à défaut le tarif par défaut.
export function computeDeliveryFee(
  store: StorePaymentSettings | null,
  neighborhood: string,
  subtotal: number,
  deliveryMode: "delivery" | "pickup"
): { fee: number; free: boolean } {
  if (deliveryMode !== "delivery") return { fee: 0, free: false };
  const threshold = store?.free_delivery_threshold ?? null;
  if (threshold != null && subtotal >= threshold) return { fee: 0, free: true };
  const zoneFee = zoneFeeFor(store?.delivery_zones, neighborhood);
  return { fee: zoneFee ?? store?.default_delivery_fee ?? 0, free: false };
}

// Paiement à la livraison autorisé pour le quartier ? Si cod_zones est vide,
// aucune restriction de zone ; sinon le quartier doit y figurer.
export function codZoneAllowed(store: StorePaymentSettings | null, neighborhood: string): boolean {
  const zones = store?.cod_zones;
  if (!zones || zones.length === 0) return true;
  const q = neighborhood.trim().toLowerCase();
  return zones.some((z) => z.trim().toLowerCase() === q);
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

  // Produits actifs paginés, avec recherche (nom) / catégorie / tri CÔTÉ SERVEUR.
  async getProductsPage(opts?: {
    limit?: number;
    offset?: number;
    search?: string | null;
    category?: string | null;
    sort?: ProductSort;
  }): Promise<MarketplaceProduct[]> {
    const limit = opts?.limit ?? 20;
    const offset = opts?.offset ?? 0;
    let query = supabase.from("marketplace_products").select("*").eq("is_active", true);
    const s = opts?.search?.trim();
    if (s) query = query.ilike("name", `%${s}%`);
    if (opts?.category) query = query.eq("category", opts.category);
    switch (opts?.sort) {
      case "price_asc":
        query = query.order("price", { ascending: true });
        break;
      case "price_desc":
        query = query.order("price", { ascending: false });
        break;
      case "rating":
        query = query.order("rating_avg", { ascending: false });
        break;
      default:
        query = query.order("created_at", { ascending: false });
    }
    const { data, error } = await query.range(offset, offset + limit - 1);
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

  // Détail d'une commande (la RLS limite à ses propres commandes).
  async getOrder(id: string): Promise<MarketplaceOrder | null> {
    const { data, error } = await supabase
      .from("marketplace_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  },

  // Historique horodaté des statuts (rempli automatiquement par trigger).
  async getOrderEvents(orderId: string): Promise<OrderEvent[]> {
    const { data, error } = await supabase
      .from("order_events")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  // Annule SA propre commande (autorisé par orders_update_own ; côté UI réservé
  // au statut « pending »).
  async cancelOrder(id: string): Promise<void> {
    const { error } = await supabase
      .from("marketplace_orders")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) throw error;
  },

  // Crée une commande dans marketplace_orders. La commande est TOUJOURS créée
  // « non payée » : is_paid / paid_at ne sont jamais fournis par le client
  // (le trigger serveur les refuserait, cf. P0-1). Le passage à « payé » est
  // décidé côté serveur : par l'admin à la validation, ou par un webhook de
  // paiement vérifié cryptographiquement (Orange Money / MTN) à venir.
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
        .select("cod_enabled, cod_max_amount, cod_zones, whatsapp_enabled, whatsapp_number, default_delivery_fee, free_delivery_threshold, delivery_zones")
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return data;
    } catch {
      return null;
    }
  },
};
