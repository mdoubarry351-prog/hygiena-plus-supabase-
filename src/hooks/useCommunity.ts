import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { communityService, type CommunityPostWithAuthor } from "@/lib/community-service";

export function useCommunity() {
  const { session } = useAuth();
  const [posts, setPosts] = useState<CommunityPostWithAuthor[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await communityService.getPosts();
      setPosts(data);
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

  useEffect(() => { load(); }, [load]);

  // Bascule le like d'une publication avec mise à jour optimiste de l'UI.
  const toggleLike = useCallback(
    async (postId: string) => {
      if (!session?.user) return;
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

  return { posts, likedIds, loading, error, reload: load, toggleLike };
}
