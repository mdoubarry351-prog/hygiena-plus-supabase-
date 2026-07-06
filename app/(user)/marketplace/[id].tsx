import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";
import { StarRating } from "@/components/StarRating";
import { ReviewsSection } from "@/components/ReviewsSection";
import { ProductGallery } from "@/components/ProductGallery";
import { AppImage } from "@/components/AppImage";
import { HeartButton } from "@/components/HeartButton";
import { FadeInView } from "@/components/FadeInView";
import { FadeZoomIn } from "@/components/FadeZoomIn";
import { useFavorites } from "@/hooks/useFavorites";
import { hapticLight } from "@/lib/haptics";
import { useToast } from "@/providers/ToastProvider";
import { useCart } from "@/providers/CartProvider";
import { marketplaceService, formatPrice } from "@/lib/marketplace-service";
import type { MarketplaceProduct } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

const STEP = 55; // pas de l'apparition échelonnée (cohérent Vagues 1-3)

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addItem } = useCart();
  const { favIds, toggle } = useFavorites();
  const toast = useToast();

  const [product, setProduct] = useState<MarketplaceProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [related, setRelated] = useState<MarketplaceProduct[]>([]);

  // Rafraîchit la note moyenne après dépôt/suppression d'un avis.
  async function reloadProduct() {
    try {
      const p = await marketplaceService.getProduct(id);
      setProduct(p);
    } catch {
      // silencieux : on garde l'affichage courant
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = await marketplaceService.getProduct(id);
        if (mounted) setProduct(p);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Produit introuvable");
        router.back();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  // Produits liés (« Vous aimerez aussi ») : même catégorie, exclut le produit
  // courant ; repli sur les mieux notés si pas de catégorie. Best-effort, non bloquant.
  useEffect(() => {
    if (!product) return;
    let alive = true;
    (async () => {
      try {
        const items = await marketplaceService.getProductsPage({ category: product.category ?? null, limit: 8, sort: "rating" });
        if (alive) setRelated(items.filter((p) => p.id !== product.id).slice(0, 6));
      } catch {
        // silencieux
      }
    })();
    return () => { alive = false; };
  }, [product?.id, product?.category]);

  if (loading) return <Loading />;
  if (!product) return null;

  const outOfStock = product.stock <= 0;
  const maxReached = quantity >= product.stock;

  function handleAddToCart() {
    if (!product) return;
    addItem(product, quantity);
    hapticLight();
    toast.success(`${quantity} × ${product.name} ajouté au panier`);
  }

  // « Acheter maintenant » : ajoute au panier (logique existante) puis va droit au
  // checkout. Aucun nouveau flux de paiement — réutilise panier + checkout.
  function handleBuyNow() {
    if (!product || outOfStock) return;
    addItem(product, quantity);
    hapticLight();
    router.push("/(user)/marketplace/checkout");
  }

  return (
    <Screen>
      <View style={styles.fill}>
      <ScreenHeader
        right={
          <Pressable onPress={() => { hapticLight(); toggle(product.id); }} hitSlop={10} accessibilityRole="button" accessibilityLabel={favIds.has(product.id) ? "Retirer des favoris" : "Ajouter aux favoris"}>
            <HeartButton active={favIds.has(product.id)} size={24} activeColor={colors.danger} inactiveColor={colors.text} />
          </Pressable>
        }
      />
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <FadeZoomIn>
          {(product.image_urls?.length || product.image_url) ? (
            <ProductGallery imageUrls={product.image_urls} imageUrl={product.image_url} />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Ionicons name="bag-outline" size={48} color={colors.textMuted} />
            </View>
          )}
        </FadeZoomIn>

        <FadeInView fill={false} delay={STEP} style={styles.headBlock}>
          <Text style={typography.h2}>{product.name}</Text>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
          <StarRating value={product.rating_avg} count={product.rating_count} size={16} />
          {outOfStock ? (
            <Text style={styles.stockOut}>Rupture de stock</Text>
          ) : (
            <Text style={styles.stockIn}>En stock : {product.stock}</Text>
          )}
        </FadeInView>

        {product.description ? (
          <FadeInView fill={false} delay={STEP * 2}>
            <Card style={styles.card}>
              <Text style={typography.h3}>Description</Text>
              <Text style={[typography.body, styles.descText]}>{product.description}</Text>
            </Card>
          </FadeInView>
        ) : null}

        <FadeInView fill={false} delay={STEP * 3} style={styles.ctaBlock}>
          {!outOfStock && (
            <View style={styles.qtyBlock}>
              <Text style={[typography.h3, styles.qtyLabel]}>Quantité</Text>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => { hapticLight(); setQuantity((q) => Math.max(1, q - 1)); }}
                  style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Diminuer la quantité"
                >
                  <Ionicons name="remove" size={20} color={colors.text} />
                </Pressable>
                <Text style={styles.qtyValue}>{quantity}</Text>
                <Pressable
                  onPress={() => { hapticLight(); setQuantity((q) => Math.min(product.stock, q + 1)); }}
                  style={({ pressed }) => [styles.stepBtn, maxReached && styles.stepBtnDisabled, pressed && !maxReached && styles.stepBtnPressed]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Augmenter la quantité"
                >
                  <Ionicons name="add" size={20} color={maxReached ? colors.textMuted : colors.text} />
                </Pressable>
              </View>
            </View>
          )}
        </FadeInView>

        {related.length > 0 ? (
          <FadeInView fill={false} delay={STEP * 4}>
            <Text style={[typography.h3, styles.relTitle]}>Vous aimerez aussi</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relRow}>
              {related.map((p) => {
                const img = p.image_urls?.[0] ?? p.image_url ?? null;
                return (
                  <Pressable key={p.id} onPress={() => { hapticLight(); router.push(`/(user)/marketplace/${p.id}`); }} style={({ pressed }) => [styles.relCard, pressed && styles.relCardPressed]} accessibilityRole="button" accessibilityLabel={p.name}>
                    {img ? (
                      <AppImage source={img} style={styles.relImg} contentFit="contain" />
                    ) : (
                      <View style={[styles.relImg, styles.relImgPlaceholder]}>
                        <Ionicons name="bag-outline" size={26} color={colors.textMuted} />
                      </View>
                    )}
                    <Text style={styles.relName} numberOfLines={2}>{p.name}</Text>
                    <Text style={styles.relPrice}>{formatPrice(p.price)}</Text>
                    {p.rating_count > 0 ? <StarRating value={p.rating_avg} count={p.rating_count} size={11} compact /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </FadeInView>
        ) : null}

        <FadeInView fill={false} delay={STEP * 5}>
          <ReviewsSection
            kind="product"
            targetId={product.id}
            ratingAvg={product.rating_avg}
            ratingCount={product.rating_count}
            onChanged={reloadProduct}
          />
        </FadeInView>
      </ScrollView>

      {/* Barre d'achat sticky : prix bien visible + ajout panier / achat direct. */}
      <View style={styles.buyBar}>
        {outOfStock ? (
          <Button title="Indisponible" disabled />
        ) : (
          <>
            <View style={styles.buyBarTop}>
              <Text style={styles.buyBarLabel}>Total</Text>
              <Text style={styles.buyBarValue}>{formatPrice(product.price * quantity)}</Text>
            </View>
            <View style={styles.buyBarBtns}>
              <View style={styles.buyBarBtn}>
                <Button title="Ajouter" variant="outline" icon="cart-outline" onPress={handleAddToCart} />
              </View>
              <View style={styles.buyBarBtn}>
                <Button title="Acheter" icon="flash-outline" onPress={handleBuyNow} />
              </View>
            </View>
          </>
        )}
      </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  // Produits liés (« Vous aimerez aussi »)
  relTitle: { marginBottom: spacing.sm },
  relRow: { gap: spacing.sm, paddingBottom: spacing.xs },
  relCard: { width: 130, gap: spacing.xs },
  relCardPressed: { opacity: 0.7 },
  relImg: { width: 130, height: 130, borderRadius: radius.md, backgroundColor: colors.surface },
  relImgPlaceholder: { alignItems: "center", justifyContent: "center" },
  relName: { ...typography.caption, color: colors.text, fontWeight: "600" },
  relPrice: { ...typography.body, color: colors.primary, fontWeight: "700" },
  // Barre d'achat sticky
  buyBar: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card,
  },
  buyBarTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  buyBarBtns: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  buyBarLabel: { ...typography.caption, color: colors.textMuted },
  buyBarValue: { ...typography.h2, color: colors.primary },
  buyBarBtn: { flex: 1 },
  headBlock: { gap: spacing.xs },
  ctaBlock: { gap: spacing.md },
  image: { width: "100%", height: 300, borderRadius: radius.lg, backgroundColor: colors.surface },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  price: { ...typography.h2, color: colors.primary },
  stockIn: { ...typography.caption, color: colors.success, fontWeight: "600" },
  stockOut: { ...typography.caption, color: colors.danger, fontWeight: "600" },
  card: { gap: spacing.sm },
  descText: { color: colors.textMuted },
  qtyBlock: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xs },
  qtyLabel: { marginBottom: 0 },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepBtn: {
    width: 40, height: 40, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
  },
  stepBtnDisabled: { opacity: 0.5 },
  stepBtnPressed: { opacity: 0.6, backgroundColor: colors.primaryLight, borderColor: colors.primary },
  qtyValue: { ...typography.h3, minWidth: 28, textAlign: "center" },
});
