import { supabase } from "@/lib/supabase";
import type {
  CommunityPost,
  CommunityPostSafe,
  CommunityComment,
  Profile,
  TablesInsert,
} from "@/lib/database.types";

// Catégories de la communauté (liste fixe, FR). Défaut = « Général ».
export const COMMUNITY_CATEGORIES = [
  "Cycle",
  "Grossesse",
  "Santé sexuelle",
  "Nutrition",
  "Bien-être",
  "Général",
] as const;
export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];
export const DEFAULT_CATEGORY: CommunityCategory = "Général";

// Emoji par catégorie (AFFICHAGE seulement — la valeur stockée reste le libellé texte).
export const CATEGORY_EMOJI: Record<string, string> = {
  Cycle: "🩸",
  Grossesse: "🤰",
  "Santé sexuelle": "💗",
  Nutrition: "🥗",
  "Bien-être": "🌿",
  Général: "💬",
};

// « {emoji} {libellé} » pour l'affichage (sans emoji si catégorie inconnue/nulle).
export function categoryLabel(category: string | null | undefined): string {
  if (!category) return "";
  const emoji = CATEGORY_EMOJI[category];
  return emoji ? `${emoji} ${category}` : category;
}

// Infos d'auteur jointes depuis profiles (uniquement ce dont l'UI a besoin).
// `isVerifiedDoctor` : auteur médecin validé (badge « Médecin vérifié »).
export type PostAuthor = Pick<Profile, "full_name" | "avatar_url"> & { isVerifiedDoctor: boolean };

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
// Sous-ensemble des user_id qui sont des médecins VALIDÉS (badge vérifié).
// Requête séparée sur `doctors` (RLS doctors_select_validated l'autorise).
async function fetchVerifiedDoctorIds(ids: (string | null)[]): Promise<Set<string>> {
  const set = new Set<string>();
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (unique.length === 0) return set;
  const { data, error } = await supabase
    .from("doctors")
    .select("user_id")
    .in("user_id", unique)
    .eq("is_validated", true);
  if (error) throw error;
  for (const d of data ?? []) set.add(d.user_id);
  return set;
}

// Identifiant de l'utilisatrice courante (session locale).
async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

// Ensemble des user_id bloqués par l'utilisatrice (best-effort, non bloquant).
async function fetchBlockedIds(): Promise<Set<string>> {
  const me = await currentUserId();
  if (!me) return new Set();
  const { data, error } = await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", me);
  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.blocked_id));
}

async function fetchAuthors(ids: (string | null)[]): Promise<Map<string, PostAuthor>> {
  const map = new Map<string, PostAuthor>();
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (unique.length === 0) return map;
  const [profilesRes, verified] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url").in("id", unique),
    fetchVerifiedDoctorIds(unique),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  for (const p of profilesRes.data ?? []) {
    map.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url, isVerifiedDoctor: verified.has(p.id) });
  }
  return map;
}

// Commentaire enrichi avec son auteur + statut médecin vérifié.
export type CommunityCommentWithAuthor = CommunityComment & {
  author: Pick<Profile, "full_name" | "avatar_url"> | null;
  isVerifiedDoctor: boolean;
};

// Nom à afficher : "Anonyme" si la publication est anonyme, sinon le nom
// de l'auteur (avec repli sur "Utilisatrice" si le profil est incomplet).
export function authorDisplayName(isAnonymous: boolean, author: { full_name: string | null } | null): string {
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

// Enrichit des lignes de la vue sécurisée : auteur résolu + nb commentaires,
// et exclusion des auteurs bloqués (anonymes user_id null conservés).
async function enrichSafePosts(rows: CommunityPostSafe[]): Promise<CommunityPostWithAuthor[]> {
  const [authors, comments, blocked] = await Promise.all([
    fetchAuthors(rows.map((r) => r.user_id)),
    countComments(rows.map((r) => r.id)),
    fetchBlockedIds(),
  ]);
  return rows
    .filter((r) => !(r.user_id && blocked.has(r.user_id)))
    .map((r) => ({
      ...r,
      author: r.user_id ? authors.get(r.user_id) ?? null : null,
      comments_count: comments.get(r.id) ?? 0,
    }));
}

// Message affiché quand un trigger SQL rejette le contenu (mot interdit actif).
export const BANNED_WORD_MESSAGE =
  "Votre message contient un terme non autorisé. Merci de le reformuler.";

// Le trigger BEFORE INSERT lève l'exception `banned_word_detected` ; on la
// repère dans l'erreur Postgrest (message/details/code) renvoyée par l'insert.
function isBannedWordError(error: unknown): boolean {
  if (!error) return false;
  let blob = error instanceof Error ? error.message : "";
  try {
    blob += JSON.stringify(error);
  } catch {
    // erreur non sérialisable : on garde le message seul
  }
  return blob.toLowerCase().includes("banned_word_detected");
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
    return enrichSafePosts(data ?? []);
  },

  // Fil paginé (taille de page côté écran) : lit une tranche via .range(),
  // enrichit comme getPosts, et renvoie le nombre de lignes BRUTES lues
  // (pour savoir s'il reste des pages, indépendamment du filtrage anti-bloqué).
  async getPostsPage(opts?: { limit?: number; offset?: number }): Promise<{ posts: CommunityPostWithAuthor[]; rawCount: number }> {
    const limit = opts?.limit ?? 20;
    const offset = opts?.offset ?? 0;
    const { data, error } = await supabase
      .from("community_posts_safe")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    const rows = data ?? [];
    return { posts: await enrichSafePosts(rows), rawCount: rows.length };
  },

  // Détail d'une publication (lecture via la vue sécurisée).
  async getPost(id: string): Promise<CommunityPostWithAuthor | null> {
    const { data, error } = await supabase
      .from("community_posts_safe")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    const [authors, comments, blocked] = await Promise.all([
      fetchAuthors([data.user_id]),
      countComments([data.id]),
      fetchBlockedIds(),
    ]);
    // Auteur bloqué → publication traitée comme introuvable.
    if (data.user_id && blocked.has(data.user_id)) return null;
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
    category: string;
  }): Promise<CommunityPost> {
    const payload: TablesInsert<"community_posts"> = {
      user_id: input.userId,
      content: input.content,
      is_anonymous: input.isAnonymous,
      category: input.category,
    };
    const { data, error } = await supabase
      .from("community_posts")
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      if (isBannedWordError(error)) throw new Error(BANNED_WORD_MESSAGE);
      throw error;
    }
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
    const rows = (data ?? []) as (CommunityComment & {
      author: Pick<Profile, "full_name" | "avatar_url"> | null;
    })[];
    // Badge « médecin vérifié » + exclusion des commentaires d'auteurs bloqués.
    const [verified, blocked] = await Promise.all([
      fetchVerifiedDoctorIds(rows.map((r) => r.user_id)),
      fetchBlockedIds(),
    ]);
    return rows
      .filter((r) => !(r.user_id && blocked.has(r.user_id)))
      .map((r) => ({ ...r, isVerifiedDoctor: r.user_id ? verified.has(r.user_id) : false }));
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
    if (error) {
      if (isBannedWordError(error)) throw new Error(BANNED_WORD_MESSAGE);
      throw error;
    }
    return data;
  },

  // ---------------- Blocage d'utilisateurs ----------------
  async getBlockedIds(): Promise<Set<string>> {
    return fetchBlockedIds();
  },

  // Liste des comptes bloqués (avec nom) pour l'écran de déblocage.
  async getBlockedUsers(): Promise<{ id: string; name: string }[]> {
    const me = await currentUserId();
    if (!me) return [];
    const { data, error } = await supabase
      .from("user_blocks")
      .select("blocked_id, created_at")
      .eq("blocker_id", me)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const ids = (data ?? []).map((r) => r.blocked_id);
    if (ids.length === 0) return [];
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name?.trim() || "Utilisatrice"]));
    return ids.map((id) => ({ id, name: nameById.get(id) ?? "Utilisatrice" }));
  },

  async blockUser(userId: string): Promise<void> {
    const me = await currentUserId();
    if (!me) throw new Error("Vous devez être connectée.");
    const { error } = await supabase.from("user_blocks").insert({ blocker_id: me, blocked_id: userId });
    if (error && error.code !== "23505") throw error; // ignore le doublon (unique)
  },

  async unblockUser(userId: string): Promise<void> {
    const me = await currentUserId();
    if (!me) throw new Error("Vous devez être connectée.");
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", me)
      .eq("blocked_id", userId);
    if (error) throw error;
  },

  // ---------------- Publications enregistrées (signets) ----------------
  async getBookmarkedPostIds(): Promise<Set<string>> {
    const me = await currentUserId();
    if (!me) return new Set();
    const { data, error } = await supabase.from("post_bookmarks").select("post_id").eq("user_id", me);
    if (error) throw error;
    return new Set((data ?? []).map((r) => r.post_id));
  },

  // Publications enregistrées complètes (vue sécurisée + même enrichissement),
  // dans l'ordre d'enregistrement (récentes d'abord).
  async getBookmarkedPosts(): Promise<CommunityPostWithAuthor[]> {
    const me = await currentUserId();
    if (!me) return [];
    const { data: bm, error: bmErr } = await supabase
      .from("post_bookmarks")
      .select("post_id, created_at")
      .eq("user_id", me)
      .order("created_at", { ascending: false });
    if (bmErr) throw bmErr;
    const ids = (bm ?? []).map((r) => r.post_id);
    if (ids.length === 0) return [];
    const { data, error } = await supabase.from("community_posts_safe").select("*").in("id", ids);
    if (error) throw error;
    const enriched = await enrichSafePosts(data ?? []);
    const byId = new Map(enriched.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is CommunityPostWithAuthor => !!p);
  },

  async addBookmark(postId: string): Promise<void> {
    const me = await currentUserId();
    if (!me) throw new Error("Vous devez être connectée.");
    const { error } = await supabase.from("post_bookmarks").insert({ user_id: me, post_id: postId });
    if (error && error.code !== "23505") throw error; // ignore le doublon (unique)
  },

  async removeBookmark(postId: string): Promise<void> {
    const me = await currentUserId();
    if (!me) throw new Error("Vous devez être connectée.");
    const { error } = await supabase.from("post_bookmarks").delete().eq("user_id", me).eq("post_id", postId);
    if (error) throw error;
  },

  // isSaved = état actuel : true → retire, false → ajoute.
  async toggleBookmark(postId: string, isSaved: boolean): Promise<void> {
    if (isSaved) await this.removeBookmark(postId);
    else await this.addBookmark(postId);
  },
};
