import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/providers/AuthProvider";
import { communityService } from "@/lib/community-service";
import { hapticLight } from "@/lib/haptics";

export function useBookmarks() {
  const { session } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    if (!session?.user) { setSavedIds(new Set()); return; }
    try {
      setSavedIds(await communityService.getBookmarkedPostIds());
    } catch {
      // garde l'état courant
    }
  }, [session?.user]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  // Toggle optimiste : met à jour l'UI immédiatement, resync en cas d'échec.
  const toggle = useCallback(async (postId: string) => {
    const isSaved = savedIds.has(postId);
    hapticLight();
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(postId); else next.add(postId);
      return next;
    });
    try {
      await communityService.toggleBookmark(postId, isSaved);
    } catch {
      await reload();
    }
  }, [savedIds, reload]);

  return { savedIds, toggle, reload };
}
