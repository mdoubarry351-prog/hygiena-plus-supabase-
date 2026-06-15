import { memo, useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type ListRenderItemInfo } from "react-native";
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
import { useProducts } from "@/hooks/useProducts";
import { useFavorites } from "@/hooks/useFavorites";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useCart } from "@/providers/CartProvider";
import { hapticLight } from "@/lib/haptics";
import { formatPrice, PRODUCT_CATEGORIES, type ProductSort } from "@/lib/marketplace-service";
import type { MarketplaceProduct } from "@/lib/database.types";
import { colors, fonts, radius, spacing, typography } from "@/theme";

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
  const [refreshing, setRefreshing] = useState(false);
  const isFiltering = !!search.trim() || activeCat !== "all";

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
      <ProductRow
        product={item}
        isFav={favIds.has(item.id)}
        onToggleFav={onToggleFavProduct}
        onAdd={onAddProduct}
        onPress={onPressProduct}
      />
    ),
    [favIds, onToggleFavProduct, onAddProduct, onPressProduct]
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
          message="Vérifiez votre connexion, puis réessayez."
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
          <Pressable onPress={() => router.push("/(user)/marketplace/favorites")} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Mes favoris">
            <Ionicons name="heart-outline" size={25} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => router.push("/(user)/marketplace/orders")} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Mes commandes">
            <Ionicons name="receipt-outline" size={25} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => router.push("/(user)/marketplace/cart")} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Panier">
            <Ionicons name="cart-outline" size={26} color={colors.text} />
            {count > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{count}</Text>
              </View>
            )}
          </Pressable>
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
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={
          <EmptyState
            icon="bag-handle-outline"
            title={isFiltering ? "Aucun produit trouvé" : "Aucun produit disponible"}
            message={isFiltering ? "Essayez un autre mot-clé ou une autre catégorie." : "Revenez plus tard, de nouveaux produits arrivent bientôt."}
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

// Carte produit mémoïsée : ne se re-render que si ses props changent (perf liste).
const ProductRow = memo(function ProductRow({ product, isFav, onToggleFav, onAdd, onPress }: { product: MarketplaceProduct; isFav: boolean; onToggleFav: (id: string) => void; onAdd: (product: MarketplaceProduct) => void; onPress: (id: string) => void }) {
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
    <Card onPress={() => onPress(product.id)} accessibilityLabel={product.name} style={styles.row}>
        {thumbUrl ? (
          <AppImage source={thumbUrl} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="bag-outline" size={28} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.rowInfo}>
          <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
          {product.rating_count > 0 ? (
            <StarRating value={product.rating_avg} count={product.rating_count} size={13} compact />
          ) : null}
          {product.description ? (
            <Text style={styles.desc} numberOfLines={2}>{product.description}</Text>
          ) : null}
          <View style={styles.rowFoot}>
            <Text style={styles.price}>{formatPrice(product.price)}</Text>
            {outOfStock && <Text style={styles.outOfStock}>Rupture</Text>}
          </View>
        </View>
        <View style={styles.rowActions}>
          <Pressable onPress={() => onToggleFav(product.id)} hitSlop={10} style={styles.favBtn} accessibilityRole="button" accessibilityLabel={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}>
            <HeartButton active={isFav} size={22} activeColor={colors.danger} />
          </Pressable>
          <Pressable
            onPress={quickAdd}
            disabled={outOfStock}
            hitSlop={8}
            style={[styles.addBtn, justAdded && styles.addBtnDone, outOfStock && styles.addBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel={`Ajouter ${product.name} au panier`}
          >
            <Ionicons name={justAdded ? "checkmark" : "add"} size={20} color={colors.white} />
          </Pressable>
        </View>
    </Card>
  );
});

const THUMB = 96;
const styles = StyleSheet.create({
  favBtn: { padding: spacing.xs },
  rowActions: { alignItems: "center", justifyContent: "space-between", alignSelf: "stretch" },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  addBtnDone: { backgroundColor: colors.success },
  addBtnDisabled: { backgroundColor: colors.border },
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
  // Barres de chips : ne s'étirent JAMAIS en hauteur (même fix que la communauté).
  chipBar: { flexGrow: 0, flexShrink: 0, marginTop: spacing.sm },
  chips: { gap: spacing.xs, alignItems: "center", paddingVertical: spacing.sm, paddingRight: spacing.md },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.text },
  chipTextActive: { color: colors.white },
  sortChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
  sortChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sortChipText: { fontSize: 13, fontWeight: "700", color: colors.text },
  sortChipTextActive: { color: colors.white },
  count: { ...typography.caption, color: colors.textMuted },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  listContent: { paddingBottom: spacing.xxl, gap: spacing.md },
  footer: { alignItems: "center", paddingVertical: spacing.sm },
  loadMore: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.primary },
  loadMoreText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  empty: { gap: spacing.sm },
  muted: { color: colors.textMuted },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.md, backgroundColor: colors.surface },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1, gap: 2 },
  name: { ...typography.name },
  desc: { ...typography.caption, color: colors.textMuted },
  rowFoot: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  price: { ...typography.body, fontWeight: "700", color: colors.primary },
  outOfStock: {
    ...typography.caption, color: colors.danger, fontWeight: "600",
    backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.pill, overflow: "hidden",
  },
});
