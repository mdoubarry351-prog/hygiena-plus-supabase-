import { createContext, useContext, useMemo, useState, ReactNode } from "react";
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

/**
 * Panier en mémoire (non persisté). Disponible dans tout l'espace utilisateur.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  function addItem(product: MarketplaceProduct, quantity = 1) {
    setItems((prev) => {
      const existing = prev.find((it) => it.product.id === product.id);
      if (existing) {
        return prev.map((it) =>
          it.product.id === product.id ? { ...it, quantity: it.quantity + quantity } : it
        );
      }
      return [...prev, { product, quantity }];
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
      prev.map((it) => (it.product.id === productId ? { ...it, quantity } : it))
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
