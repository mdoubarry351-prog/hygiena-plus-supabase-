import { useState, useCallback } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Loading } from "@/components/Loading";
import { StarRating } from "@/components/StarRating";
import { useProducts } from "@/hooks/useProducts";
import { useFavorites } from "@/hooks/useFavorites";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useCart } from "@/providers/CartProvider";
import { formatPrice } from "@/lib/marketplace-service";
import type { MarketplaceProduct } from "@/lib/database.types";
import { colors, fonts, radius, spacing, typography } from "@/theme";

export default function MarketplaceHome() {
  const { products, loading, loadingMore, hasMore, reload, loadMore } = useProducts();
  const { marketplace_enabled } = useAppSettings();
  const { favIds, toggle } = useFavorites();
  const { count } = useCart();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

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
            title="Aucun produit disponible"
            message="Revenez plus tard, de nouveaux produits arrivent bientôt."
          />
        ) : (
          <>
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
