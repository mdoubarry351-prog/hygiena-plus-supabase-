import { memo, useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View, type ListRenderItemInfo } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SkeletonList } from "@/components/Skeleton";
import { StarRating } from "@/components/StarRating";
import { SegmentedControl } from "@/components/SegmentedControl";
import { AppImage } from "@/components/AppImage";
import { HeartButton } from "@/components/HeartButton";
import { BouncyIcon } from "@/components/BouncyIcon";
import { FadeInView } from "@/components/FadeInView";
import { PressableScale } from "@/components/PressableScale";
import { useProducts } from "@/hooks/useProducts";
import { useFavorites } from "@/hooks/useFavorites";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useCart } from "@/providers/CartProvider";
import { hapticLight } from "@/lib/haptics";
import { formatPrice, PRODUCT_CATEGORIES, type ProductSort } from "@/lib/marketplace-service";
import type { MarketplaceProduct } from "@/lib/database.types";
import { colors, fonts, layout, radius, shadows, spacing, typography } from "@/theme";

// Options de tri (libellés courts pour les chips).
const SORTS: { key: ProductSort; label: string }[] = [
  { key: "recent", label: "Récents" },
  { key: "price_asc", label: "Prix ↑" },
  { key: "price_desc", label: "Prix ↓" },
  { key: "rating", label: "Mieux notés" },
];

export default function MarketplaceHome() {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [sort, setSort] = useState<ProductSort>("recent");

  // Filtres appliqués CÔTÉ SERVEUR (recherche + catégorie + tri).
  const { products, loading, loadingMore, hasMore, error, reload, loadMore } = useProducts({
    search,
    category: activeCat === "all" ? null : activeCat,
    sort,
  });
  const { marketplace_enabled } = useAppSettings();
  const { favIds, toggle } = useFavorites();
  const { count, addItem } = useCart();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  const isFiltering = !!search.trim() || activeCat !== "all";

  // Grille 2 colonnes : largeur d'une carte = (contenu - gouttière) / 2.
  // Contenu = min(écran, maxContentWidth tablette) moins le padding latéral du Screen.
  const GUTTER = spacing.md;
  const cardWidth = Math.floor((Math.min(width, layout.maxContentWidth) - spacing.lg * 2 - GUTTER) / 2);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const onEndReached = useCallback(() => {
    if (hasMore && !loadingMore) loadMore();
  }, [hasMore, loadingMore, loadMore]);

  // Handlers stables (id/produit) pour mémoïser les cartes.
  const onPressProduct = useCallback((id: string) => router.push(`/(user)/marketplace/${id}`), [router]);
  const onToggleFavProduct = useCallback((id: string) => toggle(id), [toggle]);
  const onAddProduct = useCallback((product: MarketplaceProduct) => addItem(product, 1), [addItem]);

  const extra = useMemo(() => ({ favIds }), [favIds]);
  const keyExtractor = useCallback((item: MarketplaceProduct) => item.id, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<MarketplaceProduct>) => (
      <ProductCard
        product={item}
        width={cardWidth}
        isFav={favIds.has(item.id)}
        onToggleFav={onToggleFavProduct}
        onAdd={onAddProduct}
        onPress={onPressProduct}
      />
    ),
    [favIds, cardWidth, onToggleFavProduct, onAddProduct, onPressProduct]
  );

  if (loading && products.length === 0) return <SkeletonList variant="product" />;

  // Échec réseau SANS aucune donnée : vrai état d'erreur (≠ « aucun produit »).
  if (error && products.length === 0) {
    return (
      <Screen>
        <View style={styles.topBar}>
          <Text style={typography.h2}>Hygiena+ Store</Text>
        </View>
        <EmptyState
          icon="cloud-offline-outline"
          title="Connexion impossible"
          message="Vérifie ta connexion, puis réessaie."
          actionLabel="Réessayer"
          onAction={reload}
        />
      </Screen>
    );
  }

  // Module désactivé par l'admin : on bloque l'accès à la boutique.
  if (!marketplace_enabled) {
    return (
      <Screen>
        <View style={styles.topBar}>
          <Text style={typography.h2}>Hygiena+ Store</Text>
        </View>
        <EmptyState icon="bag-handle-outline" title="Service non disponible pour le moment" />
      </Screen>
    );
  }

  // En-tête de la boutique (barre + recherche + catégories + tri + compteur).
  const listHeader = (
    <View>
      {/* Données déjà chargées mais le rafraîchissement a échoué → hors-ligne. */}
      {error ? <OfflineBanner cachedAt={null} /> : null}
      <View style={styles.topBar}>
        <Text style={typography.h2}>Hygiena+ Store</Text>
        <View style={styles.actions}>
          <PressableScale onPress={() => router.push("/(user)/marketplace/favorites")} haptic hitSlop={10} scaleTo={0.86} style={styles.iconBtn} accessibilityLabel="Mes favoris">
            <Ionicons name="heart-outline" size={25} color={colors.text} />
          </PressableScale>
          <PressableScale onPress={() => router.push("/(user)/marketplace/orders")} haptic hitSlop={10} scaleTo={0.86} style={styles.iconBtn} accessibilityLabel="Mes commandes">
            <Ionicons name="receipt-outline" size={25} color={colors.text} />
          </PressableScale>
          <PressableScale onPress={() => router.push("/(user)/marketplace/cart")} haptic hitSlop={10} scaleTo={0.86} style={styles.iconBtn} accessibilityLabel="Panier">
            <Ionicons name="cart-outline" size={26} color={colors.text} />
            {count > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{count}</Text>
              </View>
            )}
          </PressableScale>
        </View>
      </View>

      <View style={styles.searchRow}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un produit…"
          autoCapitalize="none"
          style={styles.searchInput}
        />
      </View>

      <SegmentedControl
        items={["all", ...PRODUCT_CATEGORIES].map((c) => ({ key: c, label: c === "all" ? "Toutes" : c }))}
        value={activeCat}
        onChange={setActiveCat}
      />

      <SegmentedControl
        items={SORTS.map((s) => ({ key: s.key, label: s.label }))}
        value={sort}
        onChange={(k) => setSort(k as ProductSort)}
      />

      {products.length > 0 ? (
        <Text style={styles.count}>{products.length} produit{products.length > 1 ? "s" : ""}</Text>
      ) : null}
    </View>
  );

  const listFooter = hasMore ? (
    <View style={styles.footer}>
      {loadingMore ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Pressable onPress={loadMore} style={styles.loadMore}>
          <Text style={styles.loadMoreText}>Charger plus</Text>
        </Pressable>
      )}
    </View>
  ) : null;

  return (
    <Screen>
      <FlatList
        data={products}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={extra}
        numColumns={2}
        columnWrapperStyle={styles.column}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={
          <EmptyState
            icon="bag-handle-outline"
            title={isFiltering ? "Aucun produit trouvé" : "Aucun produit disponible"}
            message={isFiltering ? "Essaie un autre mot-clé ou une autre catégorie." : "Reviens plus tard, de nouveaux produits arrivent bientôt."}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={11}
        keyboardShouldPersistTaps="handled"
      />
    </Screen>
  );
}

// Carte produit grille (marketplace) mémoïsée : image en haut, nom 2 lignes,
// note compacte, prix en gras, badge « Rupture », ajout panier + favori en coin.
const ProductCard = memo(function ProductCard({ product, width, isFav, onToggleFav, onAdd, onPress }: { product: MarketplaceProduct; width: number; isFav: boolean; onToggleFav: (id: string) => void; onAdd: (product: MarketplaceProduct) => void; onPress: (id: string) => void }) {
  const outOfStock = product.stock <= 0;
  const thumbUrl = product.image_urls?.[0] ?? product.image_url;
  const [justAdded, setJustAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function quickAdd() {
    if (outOfStock) return;
    onAdd(product);
    hapticLight();
    setJustAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustAdded(false), 1200);
  }

  return (
    <FadeInView fill={false} style={[styles.cell, { width }]}>
      <Card onPress={() => onPress(product.id)} accessibilityLabel={product.name} style={styles.card}>
        <View style={styles.imageWrap}>
          {thumbUrl ? (
            <AppImage source={thumbUrl} style={styles.image} contentFit="cover" />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Ionicons name="bag-outline" size={32} color={colors.textMuted} />
            </View>
          )}
          {/* Favori discret en haut à droite. */}
          <Pressable onPress={() => { hapticLight(); onToggleFav(product.id); }} hitSlop={8} style={({ pressed }) => [styles.heartCorner, pressed && styles.cornerPressed]} accessibilityRole="button" accessibilityLabel={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}>
            <HeartButton active={isFav} size={18} activeColor={colors.danger} />
          </Pressable>
          {outOfStock ? (
            <View style={styles.ruptureBadge}><Text style={styles.ruptureText}>Rupture</Text></View>
          ) : null}
          {/* Ajout panier discret en bas à droite (micro-pop conservé). */}
          <Pressable
            onPress={quickAdd}
            disabled={outOfStock}
            hitSlop={6}
            style={({ pressed }) => [styles.addCorner, justAdded && styles.addCornerDone, outOfStock && styles.addCornerDisabled, pressed && !outOfStock && styles.cornerPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Ajouter ${product.name} au panier`}
          >
            <BouncyIcon name={justAdded ? "checkmark" : "add"} size={18} color={colors.white} popKey={justAdded} />
          </Pressable>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
          <View style={styles.ratingRow}>
            {product.rating_count > 0 ? (
              <StarRating value={product.rating_avg} count={product.rating_count} size={12} compact />
            ) : null}
          </View>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
        </View>
      </Card>
    </FadeInView>
  );
});

const styles = StyleSheet.create({
  btnPressed: { opacity: 0.6, transform: [{ scale: 0.92 }] },
  // Grille
  column: { justifyContent: "space-between", alignItems: "flex-start" },
  cell: {},
  card: { padding: 0, overflow: "hidden" },
  imageWrap: { width: "100%", aspectRatio: 1, position: "relative", backgroundColor: colors.surface },
  image: { width: "100%", height: "100%" },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  heartCorner: {
    position: "absolute", top: 6, right: 6, width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center",
  },
  cornerPressed: { opacity: 0.7, transform: [{ scale: 0.92 }] },
  ruptureBadge: {
    position: "absolute", top: 6, left: 6, backgroundColor: colors.danger,
    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill,
  },
  ruptureText: { ...typography.caption, color: colors.white, fontWeight: "700", fontSize: 11 },
  addCorner: {
    position: "absolute", bottom: 6, right: 6, width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    ...shadows.sm,
  },
  addCornerDone: { backgroundColor: colors.success },
  addCornerDisabled: { backgroundColor: colors.border },
  cardBody: { padding: spacing.sm, gap: 4 },
  ratingRow: { minHeight: 16, justifyContent: "center" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.lg },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconBtn: { padding: spacing.xs },
  cartBadge: {
    position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
  cartBadgeText: { color: colors.white, fontSize: 11, fontWeight: "700", fontFamily: fonts.bodyBold },
  searchRow: { paddingTop: spacing.sm },
  searchInput: { marginBottom: 0 },
  count: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.sm },
  listContent: { paddingBottom: spacing.xxl, gap: spacing.md },
  footer: { alignItems: "center", paddingVertical: spacing.sm },
  loadMore: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.primary },
  loadMoreText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  name: { ...typography.name, fontSize: 14, lineHeight: 18, minHeight: 36 },
  price: { ...typography.body, fontWeight: "700", fontSize: 16, color: colors.primary },
});
