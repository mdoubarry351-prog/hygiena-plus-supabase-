import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MarketplaceProduct } from "@/lib/database.types";

// Ligne du panier : un produit + une quantité.
export type CartItem = { product: MarketplaceProduct; quantity: number };

type CartState = {
  items: CartItem[];
  count: number; // quantité totale d'articles
  total: number; // montant total
  addItem: (product: MarketplaceProduct, quantity?: number) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartState | undefined>(undefined);

const CART_KEY = "cart_items_v1";

// Quantité plafonnée par le stock connu du produit (0 = pas de limite connue).
function capToStock(product: MarketplaceProduct, quantity: number): number {
  const max = typeof product.stock === "number" && product.stock > 0 ? product.stock : quantity;
  return Math.max(1, Math.min(quantity, max));
}

/**
 * Panier PERSISTÉ (AsyncStorage). Survit à la fermeture/redémarrage de l'app.
 * Le prix et le stock affichés proviennent du snapshot produit ; le montant
 * réel et le stock sont RE-VÉRIFIÉS côté serveur au checkout (RPC de confiance).
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const hydrated = useRef(false);

  // Hydratation au montage.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CART_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as CartItem[];
          if (Array.isArray(parsed)) setItems(parsed.filter((it) => it?.product?.id && it.quantity > 0));
        }
      } catch {
        // panier illisible → on repart d'un panier vide
      } finally {
        hydrated.current = true;
      }
    })();
  }, []);

  // Persistance à chaque changement (après hydratation, pour ne pas écraser).
  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(CART_KEY, JSON.stringify(items)).catch(() => {});
  }, [items]);

  function addItem(product: MarketplaceProduct, quantity = 1) {
    setItems((prev) => {
      const existing = prev.find((it) => it.product.id === product.id);
      if (existing) {
        return prev.map((it) =>
          it.product.id === product.id
            ? { ...it, product, quantity: capToStock(product, it.quantity + quantity) }
            : it
        );
      }
      return [...prev, { product, quantity: capToStock(product, quantity) }];
    });
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((it) => it.product.id !== productId));
  }

  function setQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((it) => (it.product.id === productId ? { ...it, quantity: capToStock(it.product, quantity) } : it))
    );
  }

  function clear() {
    setItems([]);
  }

  const count = useMemo(() => items.reduce((s, it) => s + it.quantity, 0), [items]);
  const total = useMemo(
    () => items.reduce((s, it) => s + it.product.price * it.quantity, 0),
    [items]
  );

  const value: CartState = { items, count, total, addItem, removeItem, setQuantity, clear };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart doit être utilisé dans <CartProvider>");
  return ctx;
}
