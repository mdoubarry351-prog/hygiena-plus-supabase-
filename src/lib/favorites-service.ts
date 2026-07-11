import { supabase } from "@/lib/supabase";
import type { MarketplaceProduct } from "@/lib/database.types";

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Vous devez être connectée.");
  return id;
}

export const favoritesService = {
  // Ensemble des product_id favoris de l'utilisatrice (pour les cœurs).
  async getFavoriteProductIds(): Promise<Set<string>> {
    const userId = await uid();
    const { data, error } = await supabase
      .from("product_favorites")
      .select("product_id")
      .eq("user_id", userId);
    if (error) throw error;
    return new Set((data ?? []).map((r) => r.product_id));
  },

  // Produits favoris complets (requête séparée sur marketplace_products),
  // ordonnés du plus récemment ajouté au plus ancien.
  async getFavoriteProducts(): Promise<MarketplaceProduct[]> {
    const userId = await uid();
    const { data, error } = await supabase
      .from("product_favorites")
      .select("product_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const ids = (data ?? []).map((r) => r.product_id);
    if (ids.length === 0) return [];
    const { data: prods, error: pErr } = await supabase
      .from("marketplace_products")
      .select("*")
      .eq("is_active", true) // un produit favorisé puis désactivé ne doit plus s'afficher
      .in("id", ids);
    if (pErr) throw pErr;
    const byId = new Map((prods ?? []).map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is MarketplaceProduct => !!p);
  },

  async addFavorite(productId: string): Promise<void> {
    const userId = await uid();
    const { error } = await supabase
      .from("product_favorites")
      .insert({ user_id: userId, product_id: productId });
    if (error && error.code !== "23505") throw error; // ignore le doublon (unique)
  },

  async removeFavorite(productId: string): Promise<void> {
    const userId = await uid();
    const { error } = await supabase
      .from("product_favorites")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", productId);
    if (error) throw error;
  },

  // isFav = état actuel : true → retire, false → ajoute.
  async toggleFavorite(productId: string, isFav: boolean): Promise<void> {
    if (isFav) await this.removeFavorite(productId);
    else await this.addFavorite(productId);
  },
};
