import { supabase } from "@/lib/supabase";
import type { Article, TablesInsert, TablesUpdate } from "@/lib/database.types";

// Catégories d'articles (liste fixe, FR). Centralisée : réutilisée par la
// bibliothèque (filtres) et le formulaire admin (select).
export const ARTICLE_CATEGORIES = [
  "Cycle",
  "Grossesse",
  "Santé sexuelle",
  "Nutrition",
  "Bien-être",
  "Contraception",
  "Général",
] as const;
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

export type ArticleInput = {
  title: string;
  category: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  isPublished: boolean;
};

export const articlesService = {
  // ---------------- Lecture publique (articles publiés) ----------------
  // RLS : seuls les articles publiés sont lisibles par les utilisatrices.
  async getPublishedArticles(category?: string): Promise<Article[]> {
    let query = supabase
      .from("articles")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false });
    if (category) query = query.eq("category", category);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async getArticle(id: string): Promise<Article | null> {
    const { data, error } = await supabase.from("articles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ?? null;
  },
};
