import { supabase } from "@/lib/supabase";
import type { ProductReview, DoctorReview } from "@/lib/database.types";

export type ProductReviewWithAuthor = ProductReview & { authorName: string };
export type DoctorReviewWithAuthor = DoctorReview & { authorName: string };

// Identifiant de l'utilisateur courant (session locale).
async function uid(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Vous devez être connectée.");
  return id;
}

// Résout les noms d'auteurs en UNE requête séparée (pas d'embed FK fragile).
async function fetchNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return map;
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", unique);
  if (error) throw error;
  for (const p of data ?? []) map.set(p.id, p.full_name?.trim() || "Utilisatrice");
  return map;
}

function isRlsError(e: { code?: string; message?: string } | null): boolean {
  return !!e && (e.code === "42501" || /row-level security|policy/i.test(e.message ?? ""));
}

export const reviewsService = {
  // ---------------- Produits ----------------
  async getProductReviews(productId: string): Promise<ProductReviewWithAuthor[]> {
    const { data, error } = await supabase
      .from("product_reviews")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const names = await fetchNames(rows.map((r) => r.user_id));
    return rows.map((r) => ({ ...r, authorName: names.get(r.user_id) ?? "Utilisatrice" }));
  },

  async getMyProductReview(productId: string): Promise<ProductReview | null> {
    const userId = await uid();
    const { data, error } = await supabase
      .from("product_reviews")
      .select("*")
      .eq("product_id", productId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsertProductReview(productId: string, rating: number, comment: string | null): Promise<ProductReview> {
    const userId = await uid();
    const { data, error } = await supabase
      .from("product_reviews")
      .upsert(
        { product_id: productId, user_id: userId, rating, comment: comment?.trim() || null },
        { onConflict: "product_id,user_id" }
      )
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async deleteMyProductReview(productId: string): Promise<void> {
    const userId = await uid();
    const { error } = await supabase
      .from("product_reviews")
      .delete()
      .eq("product_id", productId)
      .eq("user_id", userId);
    if (error) throw error;
  },

  // ---------------- Médecins ----------------
  async getDoctorReviews(doctorId: string): Promise<DoctorReviewWithAuthor[]> {
    const { data, error } = await supabase
      .from("doctor_reviews")
      .select("*")
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const names = await fetchNames(rows.map((r) => r.patient_id));
    return rows.map((r) => ({ ...r, authorName: names.get(r.patient_id) ?? "Patiente" }));
  },

  async getMyDoctorReview(doctorId: string): Promise<DoctorReview | null> {
    const userId = await uid();
    const { data, error } = await supabase
      .from("doctor_reviews")
      .select("*")
      .eq("doctor_id", doctorId)
      .eq("patient_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // True si la patiente a (eu) au moins un RDV avec ce médecin → peut laisser un avis.
  async canReviewDoctor(doctorId: string): Promise<boolean> {
    const userId = await uid();
    const { count, error } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("doctor_id", doctorId)
      .eq("patient_id", userId);
    if (error) return false;
    return (count ?? 0) > 0;
  },

  async upsertDoctorReview(doctorId: string, rating: number, comment: string | null): Promise<DoctorReview> {
    const userId = await uid();
    const { data, error } = await supabase
      .from("doctor_reviews")
      .upsert(
        { doctor_id: doctorId, patient_id: userId, rating, comment: comment?.trim() || null },
        { onConflict: "doctor_id,patient_id" }
      )
      .select("*")
      .single();
    if (error) {
      if (isRlsError(error)) {
        throw new Error("Vous pourrez laisser un avis après une consultation avec ce médecin.");
      }
      throw error;
    }
    return data;
  },

  async deleteMyDoctorReview(doctorId: string): Promise<void> {
    const userId = await uid();
    const { error } = await supabase
      .from("doctor_reviews")
      .delete()
      .eq("doctor_id", doctorId)
      .eq("patient_id", userId);
    if (error) throw error;
  },
};
