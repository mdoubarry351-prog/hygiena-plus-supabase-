import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import { communityService, type CommunityPostWithAuthor } from "@/lib/community-service";
import { hapticLight } from "@/lib/haptics";

const PAGE_SIZE = 20;

export type CommunityFilters = {
  search?: string;
  category?: string | null;
  sort?: "recents" | "trending";
  // Filtre « Médecins » : ne montrer que les posts d'un médecin validé non anonyme.
  doctorsOnly?: boolean;
  // Filtre « Suivis » : uniquement les posts des membres que je suis.
  followedOnly?: boolean;
};

export function useCommunity(filters: CommunityFilters = {}) {
  const { session } = useAuth();
  const [posts, setPosts] = useState<CommunityPostWithAuthor[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Nombre de publications arrivées EN TEMPS RÉEL depuis le dernier chargement
  // (affiché dans la pastille « N nouvelles publications ↑ »).
  const [newPostsCount, setNewPostsCount] = useState(0);
  const offsetRef = useRef(0);
  // Ids déjà affichés (évite de compter deux fois un même post temps réel).
  const knownIdsRef = useRef<Set<string>>(new Set());
  // Filtres serveur courants, lus par load/loadMore sans recréer les callbacks.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const serverFilters = () => ({
    search: filtersRef.current.search?.trim() || null,
    category: filtersRef.current.category ?? null,
    sort: filtersRef.current.sort ?? ("recents" as const),
    doctorsOnly: filtersRef.current.doctorsOnly ?? false,
    followedOnly: filtersRef.current.followedOnly ?? false,
  });

  // (Re)charge la première page (au focus / au changement de filtres / pastille).
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { posts: page, rawCount } = await communityService.getPostsPage({ limit: PAGE_SIZE, offset: 0, ...serverFilters() });
      setPosts(page);
      knownIdsRef.current = new Set(page.map((p) => p.id));
      setNewPostsCount(0);
      offsetRef.current = PAGE_SIZE;
      setHasMore(rawCount === PAGE_SIZE);
      if (session?.user) {
        const ids = await communityService.getLikedPostIds(session.user.id);
        setLikedIds(new Set(ids));
      } else {
        setLikedIds(new Set());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  // Page suivante (append), avec déduplication par id, sur le résultat filtré.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const { posts: page, rawCount } = await communityService.getPostsPage({ limit: PAGE_SIZE, offset: offsetRef.current, ...serverFilters() });
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const fresh = page.filter((p) => !seen.has(p.id));
        for (const p of fresh) knownIdsRef.current.add(p.id);
        return [...prev, ...fresh];
      });
      offsetRef.current += PAGE_SIZE;
      setHasMore(rawCount === PAGE_SIZE);
    } catch {
      // garde l'état courant
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  // Recharge serveur page 0 quand un filtre change (debounce ~350 ms). Le 1ᵉʳ
  // chargement est assuré par le focus de l'écran → on saute le run initial.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(() => { load(); }, 350);
    return () => clearTimeout(t);
  }, [filters.search, filters.category, filters.sort, filters.doctorsOnly, filters.followedOnly, load]);

  // ---------------- Temps réel ----------------
  // Abonnement aux NOUVELLES publications : on n'insère pas brutalement dans le
  // fil (ça ferait sauter le scroll) — on incrémente la pastille, l'utilisatrice
  // choisit quand rafraîchir. Ignore mes propres posts (déjà gérés au retour de
  // l'écran « Publier ») et les doublons.
  useEffect(() => {
    const meId = session?.user?.id;
    const channel = supabase
      .channel("community-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_posts" },
        (payload) => {
          const row = payload.new as { id?: string; user_id?: string; category?: string | null; is_anonymous?: boolean };
          if (!row?.id) return;
          if (knownIdsRef.current.has(row.id)) return;
          if (meId && row.user_id === meId) return;
          // Ne compter que les publications qui MATCHERAIENT le fil courant
          // (sinon la pastille annonce des posts qui n'apparaîtront pas au tap).
          const f = filtersRef.current;
          if (f.search?.trim()) return;                 // recherche : match non fiable côté client
          if (f.category && row.category !== f.category) return;
          if (f.doctorsOnly || f.followedOnly) return;  // statut médecin / suivi : non vérifiable ici
          if (f.doctorsOnly && row.is_anonymous) return;
          knownIdsRef.current.add(row.id);
          setNewPostsCount((n) => n + 1);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  // La pastille a été touchée → recharge la page 0 (remonte le fil, compteur remis à zéro).
  const applyNewPosts = useCallback(async () => {
    hapticLight();
    await load();
  }, [load]);

  // Bascule le like d'une publication — OPTIMISTE : l'UI réagit immédiatement,
  // la RPC `toggle_like` (1 appel) confirme, et on revient en arrière en cas d'échec.
  const toggleLike = useCallback(
    async (postId: string) => {
      if (!session?.user) return;
      hapticLight();
      const wasLiked = likedIds.has(postId);
      // 1) Mise à jour immédiate de l'UI (aucune attente réseau).
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.delete(postId);
        else next.add(postId);
        return next;
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, likes_count: Math.max((p.likes_count ?? 0) + (wasLiked ? -1 : 1), 0) }
            : p
        )
      );
      // 2) Confirmation serveur ; en cas d'échec on restaure l'état précédent.
      try {
        const { liked, likesCount } = await communityService.toggleLike(postId);
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (liked) next.add(postId);
          else next.delete(postId);
          return next;
        });
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes_count: likesCount } : p)));
      } catch (e) {
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (wasLiked) next.add(postId);
          else next.delete(postId);
          return next;
        });
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, likes_count: Math.max((p.likes_count ?? 0) + (wasLiked ? 1 : -1), 0) }
              : p
          )
        );
        setError(e instanceof Error ? e.message : "Action impossible");
      }
    },
    [session?.user, likedIds]
  );

  return { posts, likedIds, loading, loadingMore, hasMore, error, reload: load, loadMore, toggleLike, newPostsCount, applyNewPosts };
}
