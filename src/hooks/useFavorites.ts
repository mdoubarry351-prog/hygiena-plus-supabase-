import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/providers/AuthProvider";
import { favoritesService } from "@/lib/favorites-service";
import { hapticLight } from "@/lib/haptics";

export function useFavorites() {
  const { session } = useAuth();
  const [favIds, setFavIds] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    if (!session?.user) { setFavIds(new Set()); return; }
    try {
      setFavIds(await favoritesService.getFavoriteProductIds());
    } catch {
      // garde l'état courant
    }
  }, [session?.user]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  // Toggle optimiste : met à jour l'UI immédiatement, resync en cas d'échec.
  const toggle = useCallback(async (productId: string) => {
    const isFav = favIds.has(productId);
    hapticLight();
    setFavIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(productId); else next.add(productId);
      return next;
    });
    try {
      await favoritesService.toggleFavorite(productId, isFav);
    } catch {
      await reload();
    }
  }, [favIds, reload]);

  return { favIds, toggle, reload };
}
