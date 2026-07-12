import { supabase } from "@/lib/supabase";
import type {
  CommunityPost,
  CommunityPostSafe,
  CommunityComment,
  CommunityCommentSafe,
  Profile,
  TablesInsert,
  TablesUpdate,
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
// `doctorSpecialty` : spécialité du médecin validé (affichée à côté du badge).
export type PostAuthor = Pick<Profile, "full_name" | "avatar_url"> & {
  isVerifiedDoctor: boolean;
  doctorSpecialty?: string;
};

// Publication enrichie avec son auteur. Lue depuis la vue sécurisée
// `community_posts_safe` → user_id peut être null (post anonyme d'autrui),
// auteur null dans ce cas (jamais de résolution d'identité).
// `comments_count` : nombre de commentaires (compté à part — pas de colonne dédiée).
export type CommunityPostWithAuthor = CommunityPostSafe & {
  author: PostAuthor | null;
  comments_count: number;
  // Aperçu du 1ᵉʳ commentaire (fil uniquement — null si aucun commentaire).
  firstComment?: CommentPreview | null;
};

// Résultat de recherche d'un médecin (identité PUBLIQUE — jamais un membre anonyme).
// `id` = doctors.id → cible de navigation `/(user)/appointments/{id}`.
export type DoctorSearchResult = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  specialty: string | null;
};

// Mon commentaire enrichi d'un extrait de la publication parente (historique).
export type MyComment = CommunityComment & { postExcerpt: string | null };

// Aperçu d'un commentaire affiché sous la carte du post dans le fil
// (le plus aimé, sinon le plus ancien). Anonymat respecté.
export type CommentPreview = {
  name: string;
  content: string;
  isVerifiedDoctor: boolean;
};

// Profil public d'un membre (page profil communauté).
export type PublicProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  isVerifiedDoctor: boolean;
  doctorSpecialty: string | null;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isFollowedByMe: boolean;
  isMe: boolean;
};

// Normalise un texte pour comparaison insensible à la casse ET aux accents.
function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// Récupère les profils auteurs UNIQUEMENT pour des user_id non nuls
// (donc jamais pour les posts anonymes), en une requête séparée — une vue
// n'ayant pas de clé étrangère, on ne peut pas embarquer profiles directement.
// Sous-ensemble des user_id qui sont des médecins VALIDÉS → Map user_id → spécialité
// (la présence d'une clé = badge « Médecin vérifié » ; la valeur sert à l'afficher).
// Requête séparée sur `doctors` (RLS doctors_select_validated l'autorise).
async function fetchVerifiedDoctors(ids: (string | null)[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (unique.length === 0) return map;
  const { data, error } = await supabase
    .from("doctors")
    .select("user_id, specialty")
    .in("user_id", unique)
    .eq("is_validated", true);
  if (error) throw error;
  for (const d of data ?? []) map.set(d.user_id, d.specialty ?? null);
  return map;
}

// Tous les user_id des médecins VALIDÉS (pour le filtre « Médecins » du fil).
async function fetchAllValidatedDoctorIds(): Promise<string[]> {
  const { data, error } = await supabase.from("doctors").select("user_id").eq("is_validated", true);
  if (error) throw error;
  return (data ?? []).map((d) => d.user_id);
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
    fetchVerifiedDoctors(unique),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  for (const p of profilesRes.data ?? []) {
    map.set(p.id, {
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      isVerifiedDoctor: verified.has(p.id),
      doctorSpecialty: verified.get(p.id) ?? undefined,
    });
  }
  return map;
}

// Commentaire enrichi avec son auteur + statut médecin vérifié + like de l'utilisatrice.
export type CommunityCommentWithAuthor = CommunityCommentSafe & {
  author: Pick<Profile, "full_name" | "avatar_url"> | null;
  isVerifiedDoctor: boolean;
  doctorSpecialty?: string;
  likedByMe: boolean;
};

// Nom à afficher : "Anonyme" si la publication est anonyme, sinon le nom
// de l'auteur (avec repli sur "Utilisatrice" si le profil est incomplet).
export function authorDisplayName(isAnonymous: boolean, author: { full_name: string | null } | null): string {
  if (isAnonymous) return "Anonyme";
  return author?.full_name?.trim() || "Utilisatrice";
}

// Vrai si le contenu a été modifié nettement après sa création (> 60 s) →
// pour afficher la mention « · modifié ».
export function wasEdited(createdAt: string, updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return false;
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 60000;
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

// Enrichit des lignes de la vue sécurisée : auteur résolu (comments_count est
// désormais une colonne maintenue par trigger), et exclusion des auteurs bloqués.
async function enrichSafePosts(rows: CommunityPostSafe[]): Promise<CommunityPostWithAuthor[]> {
  const [authors, blocked] = await Promise.all([
    fetchAuthors(rows.map((r) => r.user_id)),
    fetchBlockedIds(),
  ]);
  return rows
    .filter((r) => !(r.user_id && blocked.has(r.user_id)))
    .map((r) => ({
      ...r,
      author: r.user_id ? authors.get(r.user_id) ?? null : null,
      comments_count: r.comments_count ?? 0,
    }));
}

// Attache à chaque post l'aperçu de son « meilleur » commentaire (le plus aimé,
// à égalité le plus ancien). UNE requête pour toute la page. Anonymat respecté :
// commentaire anonyme → nom « Anonyme », jamais de résolution d'identité.
async function attachFirstComments(posts: CommunityPostWithAuthor[]): Promise<void> {
  const ids = posts.filter((p) => (p.comments_count ?? 0) > 0).map((p) => p.id);
  if (ids.length === 0) return;
  // Vue SÉCURISÉE : user_id NULL pour un commentaire anonyme d'autrui → jamais
  // de résolution d'identité pour l'aperçu du fil.
  const { data, error } = await supabase
    .from("community_comments_safe")
    .select("post_id, content, is_anonymous, user_id, likes_count, created_at")
    .in("post_id", ids)
    .is("parent_comment_id", null)
    .order("likes_count", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) return; // aperçu best-effort : ne bloque jamais le fil
  const rows = (data ?? []) as Pick<
    CommunityCommentSafe,
    "post_id" | "content" | "is_anonymous" | "user_id" | "likes_count" | "created_at"
  >[];
  // Auteurs (nom + badge médecin) résolus séparément par user_id non anonyme.
  const authors = await fetchAuthors(rows.map((r) => r.user_id));
  const best = new Map<string, CommentPreview>();
  for (const r of rows) {
    if (best.has(r.post_id)) continue; // déjà le meilleur (tri SQL)
    const author = r.user_id ? authors.get(r.user_id) ?? null : null;
    best.set(r.post_id, {
      name: r.is_anonymous ? "Anonyme" : author?.full_name?.trim() || "Utilisatrice",
      content: r.content,
      isVerifiedDoctor: !r.is_anonymous && !!author?.isVerifiedDoctor,
    });
  }
  for (const p of posts) p.firstComment = best.get(p.id) ?? null;
}

// Raisons de signalement proposées à l'utilisatrice (modération).
export const REPORT_REASONS = [
  "Spam",
  "Contenu inapproprié",
  "Harcèlement",
  "Désinformation",
  "Autre",
] as const;

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
    // Borné : la modération admin ne charge jamais toute la table d'un coup.
    const { data, error } = await supabase
      .from("community_posts_safe")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return enrichSafePosts(data ?? []);
  },

  // Fil paginé avec recherche / catégorie / tri appliqués CÔTÉ SERVEUR.
  // - search → .ilike('content', %…%) ; category → .eq('category', …) ;
  // - sort « trending » → likes_count puis comments_count (proxy popularité),
  //   sinon « recents » → created_at desc.
  // Renvoie le nombre de lignes BRUTES lues (pour savoir s'il reste des pages).
  async getPostsPage(opts?: {
    limit?: number;
    offset?: number;
    search?: string | null;
    category?: string | null;
    sort?: "recents" | "trending";
    doctorsOnly?: boolean;
    // Filtre « Suivis » : uniquement les posts (non anonymes) des membres que je suis.
    followedOnly?: boolean;
  }): Promise<{ posts: CommunityPostWithAuthor[]; rawCount: number }> {
    const limit = opts?.limit ?? 20;
    const offset = opts?.offset ?? 0;
    let query = supabase.from("community_posts_safe").select("*");
    const s = opts?.search?.trim();
    if (s) query = query.ilike("content", `%${s}%`);
    if (opts?.category) query = query.eq("category", opts.category);
    // Filtre « Médecins » : ne garder que les posts d'un médecin VALIDÉ et non
    // anonyme. Les posts anonymes ont user_id null → naturellement exclus par .in().
    if (opts?.doctorsOnly) {
      const doctorIds = await fetchAllValidatedDoctorIds();
      if (doctorIds.length === 0) return { posts: [], rawCount: 0 };
      query = query.in("user_id", doctorIds);
    }
    if (opts?.followedOnly) {
      const followedIds = await this.getFollowedIds();
      if (followedIds.length === 0) return { posts: [], rawCount: 0 };
      query = query.in("user_id", followedIds);
    }
    if (opts?.sort === "trending") {
      // Score « hot » à décroissance temporelle calculé côté SQL (façon Reddit) :
      // un post récent avec un peu d'engagement bat un vieux post très liké.
      query = query.order("hot_score", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }
    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    const rows = data ?? [];
    const posts = await enrichSafePosts(rows);
    // Aperçu du 1ᵉʳ commentaire (le plus aimé, sinon le plus ancien) par post.
    await attachFirstComments(posts);
    return { posts, rawCount: rows.length };
  },

  // Infos « médecin vérifié » de l'utilisatrice courante (pour l'aperçu avant
  // publication). Renvoie la spécialité si elle est médecin VALIDÉE, sinon null.
  async getVerifiedDoctorInfo(userId: string): Promise<{ specialty: string | null } | null> {
    const { data, error } = await supabase
      .from("doctors")
      .select("specialty")
      .eq("user_id", userId)
      .eq("is_validated", true)
      .maybeSingle();
    if (error) return null;
    return data ? { specialty: data.specialty ?? null } : null;
  },

  // Recherche de MÉDECINS validés par nom OU spécialité (insensible casse/accents).
  // Identités publiques uniquement — jamais de membres ni de profils anonymes.
  // `id` renvoyé = doctors.id → fiche `/(user)/appointments/{id}`.
  async searchDoctors(term: string): Promise<DoctorSearchResult[]> {
    const t = normalizeText(term);
    if (!t) return [];
    const { data, error } = await supabase
      .from("doctors")
      .select("id, specialty, profile:profiles!doctors_user_id_fkey(full_name, avatar_url)")
      .eq("is_validated", true)
      .limit(200); // plafond de sécurité (le filtre par nom est fait ensuite côté client)
    if (error) throw error;
    const rows = (data ?? []) as {
      id: string;
      specialty: string | null;
      profile: { full_name: string | null; avatar_url: string | null } | null;
    }[];
    return rows
      .map((r) => ({
        id: r.id,
        full_name: r.profile?.full_name ?? null,
        avatar_url: r.profile?.avatar_url ?? null,
        specialty: r.specialty,
      }))
      .filter((d) => normalizeText(`${d.full_name ?? ""} ${d.specialty ?? ""}`).includes(t))
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "fr"));
  },

  // Détail d'une publication (lecture via la vue sécurisée).
  async getPost(id: string): Promise<CommunityPostWithAuthor | null> {
    const { data, error } = await supabase
      .from("community_posts_safe")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    const [authors, blocked] = await Promise.all([
      fetchAuthors([data.user_id]),
      fetchBlockedIds(),
    ]);
    // Auteur bloqué → publication traitée comme introuvable.
    if (data.user_id && blocked.has(data.user_id)) return null;
    return {
      ...data,
      author: data.user_id ? authors.get(data.user_id) ?? null : null,
      comments_count: data.comments_count ?? 0,
    };
  },

  // Crée une publication. `isAnonymous` masque l'auteur dans l'app.
  // `imageUrls` (optionnel) : photos déjà uploadées dans community-images.
  // On écrit le tableau dans image_urls ET la 1ʳᵉ dans image_url (compat affichage ancien).
  async createPost(input: {
    userId: string;
    content: string;
    isAnonymous: boolean;
    category: string;
    imageUrls?: string[];
  }): Promise<CommunityPost> {
    const urls = input.imageUrls ?? [];
    const payload: TablesInsert<"community_posts"> = {
      user_id: input.userId,
      content: input.content,
      is_anonymous: input.isAnonymous,
      category: input.category,
      image_urls: urls.length ? urls : null,
      image_url: urls[0] ?? null,
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

  // Modifie SA propre publication. La RLS (own_or_admin) limite l'accès.
  // `imageUrls` : undefined = inchangé, [] = retirées, sinon nouvelles photos.
  async updatePost(
    id: string,
    patch: { content: string; category: string; imageUrls?: string[] }
  ): Promise<CommunityPost> {
    const update: TablesUpdate<"community_posts"> = {
      content: patch.content,
      category: patch.category,
      updated_at: new Date().toISOString(),
    };
    if (patch.imageUrls !== undefined) {
      update.image_urls = patch.imageUrls.length ? patch.imageUrls : null;
      update.image_url = patch.imageUrls[0] ?? null;
    }
    const { data, error } = await supabase
      .from("community_posts")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      if (isBannedWordError(error)) throw new Error(BANNED_WORD_MESSAGE);
      throw error;
    }
    return data;
  },

  // Supprime SA propre publication (RLS own_or_admin). Les likes, commentaires,
  // réponses et signets sont supprimés automatiquement (ON DELETE CASCADE).
  async deletePost(id: string): Promise<void> {
    // `.select()` renvoie les lignes réellement supprimées : si la RLS
    // (own_or_admin) ne matche rien, aucune erreur n'est levée mais 0 ligne part
    // → on le détecte pour ne pas faire croire à un succès.
    const { data, error } = await supabase.from("community_posts").delete().eq("id", id).select("id");
    if (error) throw error;
    if (!data?.length) throw new Error("Suppression impossible (droits insuffisants ou publication déjà supprimée).");
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

  // Mes publications (table de base : inclut mes posts anonymes — RLS = propriétaire).
  async getMyPosts(): Promise<CommunityPost[]> {
    const me = await currentUserId();
    if (!me) return [];
    const { data, error } = await supabase
      .from("community_posts")
      .select("*")
      .eq("user_id", me)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  },

  // Mes commentaires, avec un extrait de la publication parente.
  async getMyComments(): Promise<MyComment[]> {
    const me = await currentUserId();
    if (!me) return [];
    const { data, error } = await supabase
      .from("community_comments")
      .select("*")
      .eq("user_id", me)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    const rows = (data ?? []) as CommunityComment[];
    const postIds = Array.from(new Set(rows.map((r) => r.post_id)));
    const excerpts = new Map<string, string>();
    if (postIds.length) {
      const { data: posts } = await supabase.from("community_posts_safe").select("id, content").in("id", postIds);
      for (const p of posts ?? []) excerpts.set(p.id, p.content);
    }
    return rows.map((r) => ({ ...r, postExcerpt: excerpts.get(r.post_id) ?? null }));
  },

  // Mes réactions : publications que j'ai aimées (via community_likes), plus récentes d'abord.
  async getMyLikes(): Promise<CommunityPostSafe[]> {
    const me = await currentUserId();
    if (!me) return [];
    const { data: likes, error } = await supabase
      .from("community_likes")
      .select("post_id, created_at")
      .eq("user_id", me)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    const ids = (likes ?? []).map((l) => l.post_id);
    if (ids.length === 0) return [];
    const { data: posts, error: e2 } = await supabase.from("community_posts_safe").select("*").in("id", ids);
    if (e2) throw e2;
    const map = new Map((posts ?? []).map((p) => [p.id, p]));
    return ids.map((id) => map.get(id)).filter((p): p is CommunityPostSafe => !!p);
  },

  // Like/unlike via la RPC `toggle_like` : UN SEUL aller-retour réseau.
  // Le trigger SQL `trg_post_like_aiud` maintient likes_count de façon fiable
  // (quel que soit l'auteur du post — l'ancien update client était bloqué par la RLS).
  async toggleLike(
    postId: string,
    _userId?: string
  ): Promise<{ liked: boolean; likesCount: number }> {
    const { data, error } = await supabase.rpc("toggle_like", { p_post_id: postId });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { liked: !!row?.liked, likesCount: row?.likes_count ?? 0 };
  },

  // Commentaires d'une publication, les plus anciens en premier (ordre de lecture).
  // Renvoie aussi parent_comment_id, likes_count et likedByMe (likes de l'utilisatrice).
  async getComments(postId: string): Promise<CommunityCommentWithAuthor[]> {
    // Lecture via la vue SÉCURISÉE : user_id est NULL pour un commentaire
    // anonyme d'autrui (l'identité réelle ne quitte jamais le serveur). On
    // résout donc les auteurs séparément (jamais de jointure sur les anonymes).
    const { data, error } = await supabase
      .from("community_comments_safe")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(500); // borne de sécurité sur un fil très commenté
    if (error) throw error;
    const rows = (data ?? []) as CommunityCommentSafe[];
    // Likes de l'utilisatrice sur ces commentaires (requête séparée).
    const me = await currentUserId();
    let likedSet = new Set<string>();
    if (me && rows.length) {
      const { data: likes } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", me)
        .in("comment_id", rows.map((r) => r.id));
      likedSet = new Set((likes ?? []).map((l) => l.comment_id));
    }
    // Résolution des auteurs (profils + badge médecin) par user_id NON anonyme,
    // + exclusion des commentaires d'auteurs bloqués.
    const [authors, blocked] = await Promise.all([
      fetchAuthors(rows.map((r) => r.user_id)),
      fetchBlockedIds(),
    ]);
    return rows
      .filter((r) => !(r.user_id && blocked.has(r.user_id)))
      .map((r) => {
        const author = r.user_id ? authors.get(r.user_id) ?? null : null;
        return {
          ...r,
          author: author ? { full_name: author.full_name, avatar_url: author.avatar_url } : null,
          isVerifiedDoctor: author?.isVerifiedDoctor ?? false,
          doctorSpecialty: author?.doctorSpecialty,
          likedByMe: likedSet.has(r.id),
        };
      });
  },

  // Ajoute un commentaire (ou une réponse si parentCommentId est fourni).
  async addComment(input: {
    postId: string;
    userId: string;
    content: string;
    isAnonymous: boolean;
    parentCommentId?: string | null;
  }): Promise<CommunityComment> {
    const payload: TablesInsert<"community_comments"> = {
      post_id: input.postId,
      user_id: input.userId,
      content: input.content,
      is_anonymous: input.isAnonymous,
      parent_comment_id: input.parentCommentId ?? null,
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

  // Like/unlike d'un commentaire. Le trigger SQL maintient likes_count.
  async toggleCommentLike(commentId: string, isLiked: boolean): Promise<void> {
    const me = await currentUserId();
    if (!me) throw new Error("Vous devez être connectée.");
    if (isLiked) {
      const { error } = await supabase
        .from("comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", me);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("comment_likes")
        .insert({ comment_id: commentId, user_id: me });
      if (error && error.code !== "23505") throw error; // ignore le doublon (unique)
    }
  },

  // Modifie SON propre commentaire (la RLS own_or_admin protège).
  async updateComment(id: string, content: string): Promise<CommunityComment> {
    const { data, error } = await supabase
      .from("community_comments")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      if (isBannedWordError(error)) throw new Error(BANNED_WORD_MESSAGE);
      throw error;
    }
    return data;
  },

  // Supprime SON propre commentaire (RLS own_or_admin). Ses likes et ses
  // réponses partent automatiquement (ON DELETE CASCADE).
  async deleteComment(id: string): Promise<void> {
    const { data, error } = await supabase.from("community_comments").delete().eq("id", id).select("id");
    if (error) throw error;
    if (!data?.length) throw new Error("Suppression impossible (droits insuffisants ou commentaire déjà supprimé).");
  },

  // ---------------- Signalements (modération) ----------------
  // Signale une publication. `reportedUserId` peut être null (post anonyme/auteur
  // inconnu) ; post_id suffit alors à la modération. Empêche de se signaler soi-même.
  async reportPost(postId: string, reportedUserId: string | null, reason: string): Promise<void> {
    const me = await currentUserId();
    if (!me) throw new Error("Vous devez être connectée.");
    if (reportedUserId && reportedUserId === me) {
      throw new Error("Vous ne pouvez pas vous signaler vous-même.");
    }
    const payload: TablesInsert<"user_reports"> = {
      reporter_id: me,
      reported_user_id: reportedUserId,
      post_id: postId,
      reason,
    };
    const { error } = await supabase.from("user_reports").insert(payload);
    if (error) throw error;
  },

  // Signale un commentaire. Pas de colonne comment_id → on rattache au post
  // (post_id = comment.post_id) et on préfixe la raison « Commentaire : … ».
  async reportComment(
    comment: Pick<CommunityComment, "post_id" | "is_anonymous"> & { user_id: string | null },
    reason: string
  ): Promise<void> {
    const me = await currentUserId();
    if (!me) throw new Error("Vous devez être connectée.");
    if (comment.user_id && comment.user_id === me) {
      throw new Error("Vous ne pouvez pas vous signaler vous-même.");
    }
    const payload: TablesInsert<"user_reports"> = {
      reporter_id: me,
      // Anonymat préservé : on n'expose pas l'auteur d'un commentaire anonyme.
      reported_user_id: comment.is_anonymous ? null : (comment.user_id ?? null),
      post_id: comment.post_id,
      reason: `Commentaire : ${reason}`,
    };
    const { error } = await supabase.from("user_reports").insert(payload);
    if (error) throw error;
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

  // ---------------- Abonnements (follows) ----------------
  // Suit / ne suit plus un membre en 1 appel RPC. Renvoie l'état final.
  async toggleFollow(targetUserId: string): Promise<{ following: boolean; followersCount: number }> {
    const { data, error } = await supabase.rpc("toggle_follow", { p_target: targetUserId });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { following: !!row?.following, followersCount: row?.followers_count ?? 0 };
  },

  // Ids des membres que JE suis (pour le filtre « Suivis » du fil).
  async getFollowedIds(): Promise<string[]> {
    const me = await currentUserId();
    if (!me) return [];
    const { data, error } = await supabase
      .from("user_follows")
      .select("followed_id")
      .eq("follower_id", me);
    if (error) return [];
    return (data ?? []).map((r) => r.followed_id);
  },

  // Ensemble (Set) des membres suivis — pratique pour marquer les cartes du fil.
  async getFollowedIdSet(): Promise<Set<string>> {
    return new Set(await this.getFollowedIds());
  },

  // ---------------- Profil public d'un membre ----------------
  // Profil + compteurs + état « suivi » en parallèle. Ne JAMAIS appeler pour
  // un post anonyme (user_id null dans la vue → pas de navigation possible).
  async getPublicProfile(userId: string): Promise<PublicProfile | null> {
    const me = await currentUserId();
    const [profRes, verified, postsRes, followersRes, followingRes, meFollowRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url, created_at").eq("id", userId).maybeSingle(),
      fetchVerifiedDoctors([userId]),
      supabase
        .from("community_posts_safe")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_anonymous", false),
      supabase.from("user_follows").select("id", { count: "exact", head: true }).eq("followed_id", userId),
      supabase.from("user_follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
      me
        ? supabase
            .from("user_follows")
            .select("id", { count: "exact", head: true })
            .eq("follower_id", me)
            .eq("followed_id", userId)
        : Promise.resolve({ count: 0 } as { count: number | null }),
    ]);
    if (profRes.error || !profRes.data) return null;
    return {
      id: profRes.data.id,
      full_name: profRes.data.full_name,
      avatar_url: profRes.data.avatar_url,
      created_at: profRes.data.created_at,
      isVerifiedDoctor: verified.has(userId),
      doctorSpecialty: verified.get(userId) ?? null,
      postsCount: postsRes.count ?? 0,
      followersCount: followersRes.count ?? 0,
      followingCount: followingRes.count ?? 0,
      isFollowedByMe: (meFollowRes.count ?? 0) > 0,
      isMe: me === userId,
    };
  },

  // Publications PUBLIQUES (non anonymes) d'un membre, récentes d'abord.
  async getUserPosts(userId: string): Promise<CommunityPostWithAuthor[]> {
    const { data, error } = await supabase
      .from("community_posts_safe")
      .select("*")
      .eq("user_id", userId)
      .eq("is_anonymous", false)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    const posts = await enrichSafePosts(data ?? []);
    await attachFirstComments(posts);
    return posts;
  },
};
