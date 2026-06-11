import { supabase } from "@/lib/supabase";
import type {
  CommunityPost,
  CommunityPostSafe,
  CommunityComment,
  Profile,
  TablesInsert,
} from "@/lib/database.types";

// Infos d'auteur jointes depuis profiles (uniquement ce dont l'UI a besoin).
export type PostAuthor = Pick<Profile, "full_name" | "avatar_url">;

// Publication enrichie avec son auteur. Lue depuis la vue sécurisée
// `community_posts_safe` → user_id peut être null (post anonyme d'autrui),
// auteur null dans ce cas (jamais de résolution d'identité).
// `comments_count` : nombre de commentaires (compté à part — pas de colonne dédiée).
export type CommunityPostWithAuthor = CommunityPostSafe & {
  author: PostAuthor | null;
  comments_count: number;
};

// Compte les commentaires par publication en UNE requête (pas de N+1) :
// on récupère les post_id de community_comments pour les ids de la page,
// puis on agrège côté JS. Respecte la RLS de lecture des commentaires existante.
async function countComments(ids: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase
    .from("community_comments")
    .select("post_id")
    .in("post_id", ids);
  if (error) throw error;
  for (const row of data ?? []) {
    map.set(row.post_id, (map.get(row.post_id) ?? 0) + 1);
  }
  return map;
}

// Récupère les profils auteurs UNIQUEMENT pour des user_id non nuls
// (donc jamais pour les posts anonymes), en une requête séparée — une vue
// n'ayant pas de clé étrangère, on ne peut pas embarquer profiles directement.
async function fetchAuthors(ids: (string | null)[]): Promise<Map<string, PostAuthor>> {
  const map = new Map<string, PostAuthor>();
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (unique.length === 0) return map;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", unique);
  if (error) throw error;
  for (const p of data ?? []) {
    map.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url });
  }
  return map;
}

// Commentaire enrichi avec son auteur.
export type CommunityCommentWithAuthor = CommunityComment & { author: PostAuthor | null };

// Nom à afficher : "Anonyme" si la publication est anonyme, sinon le nom
// de l'auteur (avec repli sur "Utilisatrice" si le profil est incomplet).
export function authorDisplayName(isAnonymous: boolean, author: PostAuthor | null): string {
  if (isAnonymous) return "Anonyme";
  return author?.full_name?.trim() || "Utilisatrice";
}

// Formatage d'une date en libellé relatif français (ex. "il y a 3 h").
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export const communityService = {
  // Fil d'actualité : lecture via la vue sécurisée community_posts_safe
  // (anonymat garanti côté SQL), puis fusion des auteurs côté JS.
  async getPosts(): Promise<CommunityPostWithAuthor[]> {
    const { data, error } = await supabase
      .from("community_posts_safe")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const [authors, comments] = await Promise.all([
      fetchAuthors(rows.map((r) => r.user_id)),
      countComments(rows.map((r) => r.id)),
    ]);
    return rows.map((r) => ({
      ...r,
      author: r.user_id ? authors.get(r.user_id) ?? null : null,
      comments_count: comments.get(r.id) ?? 0,
    }));
  },

  // Détail d'une publication (lecture via la vue sécurisée).
  async getPost(id: string): Promise<CommunityPostWithAuthor | null> {
    const { data, error } = await supabase
      .from("community_posts_safe")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    const [authors, comments] = await Promise.all([
      fetchAuthors([data.user_id]),
      countComments([data.id]),
    ]);
    return {
      ...data,
      author: data.user_id ? authors.get(data.user_id) ?? null : null,
      comments_count: comments.get(data.id) ?? 0,
    };
  },

  // Crée une publication. `isAnonymous` masque l'auteur dans l'app.
  async createPost(input: {
    userId: string;
    content: string;
    isAnonymous: boolean;
  }): Promise<CommunityPost> {
    const payload: TablesInsert<"community_posts"> = {
      user_id: input.userId,
      content: input.content,
      is_anonymous: input.isAnonymous,
    };
    const { data, error } = await supabase
      .from("community_posts")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  // Identifiants des publications déjà aimées par l'utilisateur.
  async getLikedPostIds(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("community_likes")
      .select("post_id")
      .eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).map((row) => row.post_id);
  },

  // Ajoute / retire un like via community_likes puis recalcule likes_count
  // sur la publication. Retourne l'état final (liké ou non) et le compteur.
  async toggleLike(
    postId: string,
    userId: string
  ): Promise<{ liked: boolean; likesCount: number }> {
    const { data: existing, error: selErr } = await supabase
      .from("community_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();
    if (selErr) throw selErr;

    if (existing) {
      const { error } = await supabase.from("community_likes").delete().eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("community_likes")
        .insert({ post_id: postId, user_id: userId });
      if (error) throw error;
    }

    // Recompte les likes réels puis met à jour le compteur dénormalisé.
    const { count, error: cntErr } = await supabase
      .from("community_likes")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId);
    if (cntErr) throw cntErr;

    const likesCount = count ?? 0;
    const { error: updErr } = await supabase
      .from("community_posts")
      .update({ likes_count: likesCount })
      .eq("id", postId);
    if (updErr) throw updErr;

    return { liked: !existing, likesCount };
  },

  // Commentaires d'une publication, les plus anciens en premier (ordre de lecture).
  async getComments(postId: string): Promise<CommunityCommentWithAuthor[]> {
    const { data, error } = await supabase
      .from("community_comments")
      .select("*, author:profiles(full_name, avatar_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as CommunityCommentWithAuthor[];
  },

  // Ajoute un commentaire à une publication.
  async addComment(input: {
    postId: string;
    userId: string;
    content: string;
    isAnonymous: boolean;
  }): Promise<CommunityComment> {
    const payload: TablesInsert<"community_comments"> = {
      post_id: input.postId,
      user_id: input.userId,
      content: input.content,
      is_anonymous: input.isAnonymous,
    };
    const { data, error } = await supabase
      .from("community_comments")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },
};
