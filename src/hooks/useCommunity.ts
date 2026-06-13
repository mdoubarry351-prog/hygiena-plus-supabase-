import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { communityService, type CommunityPostWithAuthor } from "@/lib/community-service";
import { hapticLight } from "@/lib/haptics";

const PAGE_SIZE = 20;

export type CommunityFilters = {
  search?: string;
  category?: string | null;
  sort?: "recents" | "trending";
};

export function useCommunity(filters: CommunityFilters = {}) {
  const { session } = useAuth();
  const [posts, setPosts] = useState<CommunityPostWithAuthor[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  // Filtres serveur courants, lus par load/loadMore sans recréer les callbacks.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const serverFilters = () => ({
    search: filtersRef.current.search?.trim() || null,
    category: filtersRef.current.category ?? null,
    sort: filtersRef.current.sort ?? ("recents" as const),
  });

  // (Re)charge la première page (au focus / au changement de filtres).
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { posts: page, rawCount } = await communityService.getPostsPage({ limit: PAGE_SIZE, offset: 0, ...serverFilters() });
      setPosts(page);
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
        return [...prev, ...page.filter((p) => !seen.has(p.id))];
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
  }, [filters.search, filters.category, filters.sort, load]);

  // Bascule le like d'une publication avec mise à jour optimiste de l'UI.
  const toggleLike = useCallback(
    async (postId: string) => {
      if (!session?.user) return;
      hapticLight();
      try {
        const { liked, likesCount } = await communityService.toggleLike(postId, session.user.id);
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (liked) next.add(postId);
          else next.delete(postId);
          return next;
        });
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, likes_count: likesCount } : p))
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action impossible");
      }
    },
    [session?.user]
  );

  return { posts, likedIds, loading, loadingMore, hasMore, error, reload: load, loadMore, toggleLike };
}
