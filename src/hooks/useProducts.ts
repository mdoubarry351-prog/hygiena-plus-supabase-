import { useCallback, useEffect, useRef, useState } from "react";
import { marketplaceService } from "@/lib/marketplace-service";
import type { MarketplaceProduct } from "@/lib/database.types";

const PAGE_SIZE = 20;

export function useProducts() {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await marketplaceService.getProductsPage({ limit: PAGE_SIZE, offset: 0 });
      setProducts(data);
      offsetRef.current = PAGE_SIZE;
      setHasMore(data.length === PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await marketplaceService.getProductsPage({ limit: PAGE_SIZE, offset: offsetRef.current });
      setProducts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...data.filter((p) => !seen.has(p.id))];
      });
      offsetRef.current += PAGE_SIZE;
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      // garde l'état courant
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  useEffect(() => { load(); }, [load]);

  return { products, loading, loadingMore, hasMore, error, reload: load, loadMore };
}
