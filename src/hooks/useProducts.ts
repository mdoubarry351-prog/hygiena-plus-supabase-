import { useCallback, useEffect, useRef, useState } from "react";
import { marketplaceService, type ProductSort } from "@/lib/marketplace-service";
import type { MarketplaceProduct } from "@/lib/database.types";

const PAGE_SIZE = 20;

export type ProductFilters = {
  search?: string;
  category?: string | null;
  sort?: ProductSort;
};

export function useProducts(filters: ProductFilters = {}) {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
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
    sort: filtersRef.current.sort ?? ("recent" as const),
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await marketplaceService.getProductsPage({ limit: PAGE_SIZE, offset: 0, ...serverFilters() });
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
      const data = await marketplaceService.getProductsPage({ limit: PAGE_SIZE, offset: offsetRef.current, ...serverFilters() });
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

  // Recharge serveur page 0 au changement de filtre (debounce ~350 ms). Le 1ᵉʳ
  // chargement est assuré par le focus de l'écran → on saute le run initial.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(() => { load(); }, 350);
    return () => clearTimeout(t);
  }, [filters.search, filters.category, filters.sort, load]);

  return { products, loading, loadingMore, hasMore, error, reload: load, loadMore };
}
