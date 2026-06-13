import { useState, useCallback } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";
import { Loading } from "@/components/Loading";
import { StarRating } from "@/components/StarRating";
import { useProducts } from "@/hooks/useProducts";
import { useFavorites } from "@/hooks/useFavorites";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useCart } from "@/providers/CartProvider";
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
  const { products, loading, loadingMore, hasMore, reload, loadMore } = useProducts({
    search,
    category: activeCat === "all" ? null : activeCat,
    sort,
  });
  const { marketplace_enabled } = useAppSettings();
  const { favIds, toggle } = useFavorites();
  const { count } = useCart();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const isFiltering = !!search.trim() || activeCat !== "all";

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  async function onRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 220) loadMore();
  }

  if (loading && products.length === 0) return <Loading />;

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

  return (
    <Screen>
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

      {/* Recherche */}
      <View style={styles.searchRow}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un produit…"
          autoCapitalize="none"
          style={styles.searchInput}
        />
      </View>

      {/* Catégories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
        {["all", ...PRODUCT_CATEGORIES].map((c) => {
          const active = activeCat === c;
          return (
            <Pressable key={c} onPress={() => setActiveCat(c)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c === "all" ? "Toutes" : c}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Tri */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
        {SORTS.map((s) => {
          const active = sort === s.key;
          return (
            <Pressable key={s.key} onPress={() => setSort(s.key)} style={[styles.sortChip, active && styles.sortChipActive]}>
              <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onScroll={handleScroll}
        scrollEventThrottle={400}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {products.length === 0 ? (
          <EmptyState
            icon="bag-handle-outline"
            title={isFiltering ? "Aucun produit trouvé" : "Aucun produit disponible"}
            message={isFiltering ? "Essayez un autre mot-clé ou une autre catégorie." : "Revenez plus tard, de nouveaux produits arrivent bientôt."}
          />
        ) : (
          <>
            <Text style={styles.count}>{products.length} produit{products.length > 1 ? "s" : ""}</Text>
            {products.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                isFav={favIds.has(p.id)}
                onToggleFav={() => toggle(p.id)}
                onPress={() => router.push(`/(user)/marketplace/${p.id}`)}
              />
            ))}
            {hasMore ? (
              <View style={styles.footer}>
                {loadingMore ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Pressable onPress={loadMore} style={styles.loadMore}>
                    <Text style={styles.loadMoreText}>Charger plus</Text>
                  </Pressable>
                )}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function ProductRow({ product, isFav, onToggleFav, onPress }: { product: MarketplaceProduct; isFav: boolean; onToggleFav: () => void; onPress: () => void }) {
  const outOfStock = product.stock <= 0;
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.row}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.thumb} resizeMode="cover" />
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
        <Pressable onPress={onToggleFav} hitSlop={10} style={styles.favBtn} accessibilityRole="button" accessibilityLabel={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}>
          <Ionicons
            name={isFav ? "heart" : "heart-outline"}
            size={22}
            color={isFav ? colors.danger : colors.textMuted}
          />
        </Pressable>
      </Card>
    </Pressable>
  );
}

const THUMB = 96;
const styles = StyleSheet.create({
  favBtn: { padding: spacing.xs },
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
  chipBar: { marginTop: spacing.sm },
  chips: { gap: spacing.xs, paddingRight: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, fontWeight: "700", color: colors.text },
  chipTextActive: { color: colors.white },
  sortChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.surface },
  sortChipActive: { backgroundColor: colors.primaryLight },
  sortChipText: { ...typography.caption, fontWeight: "600", color: colors.textMuted },
  sortChipTextActive: { color: colors.primaryDark, fontWeight: "700" },
  count: { ...typography.caption, color: colors.textMuted },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
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
