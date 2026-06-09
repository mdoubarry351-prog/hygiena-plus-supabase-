import { useState, useCallback } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Loading } from "@/components/Loading";
import { useProducts } from "@/hooks/useProducts";
import { useCart } from "@/providers/CartProvider";
import { formatPrice } from "@/lib/marketplace-service";
import type { MarketplaceProduct } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

export default function MarketplaceHome() {
  const { products, loading, reload } = useProducts();
  const { count } = useCart();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  async function onRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  if (loading && products.length === 0) return <Loading />;

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={typography.h2}>Boutique</Text>
        <Pressable onPress={() => router.push("/(user)/marketplace/cart")} hitSlop={10} style={styles.cartBtn}>
          <Ionicons name="cart-outline" size={26} color={colors.text} />
          {count > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{count}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {products.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={typography.h3}>Aucun produit disponible</Text>
            <Text style={[typography.body, styles.muted]}>
              Revenez plus tard, de nouveaux produits arrivent bientôt.
            </Text>
          </Card>
        ) : (
          products.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              onPress={() => router.push(`/(user)/marketplace/${p.id}`)}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function ProductRow({ product, onPress }: { product: MarketplaceProduct; onPress: () => void }) {
  const outOfStock = product.stock <= 0;
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.row}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="bag-outline" size={28} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.rowInfo}>
          <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
          {product.description ? (
            <Text style={styles.desc} numberOfLines={2}>{product.description}</Text>
          ) : null}
          <View style={styles.rowFoot}>
            <Text style={styles.price}>{formatPrice(product.price)}</Text>
            {outOfStock && <Text style={styles.outOfStock}>Rupture</Text>}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Card>
    </Pressable>
  );
}

const THUMB = 72;
const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.lg },
  cartBtn: { padding: spacing.xs },
  cartBadge: {
    position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
  cartBadgeText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  empty: { gap: spacing.sm },
  muted: { color: colors.textMuted },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.md, backgroundColor: colors.surface },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1, gap: 2 },
  name: { ...typography.body, fontWeight: "600" },
  desc: { ...typography.caption, color: colors.textMuted },
  rowFoot: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  price: { ...typography.body, fontWeight: "700", color: colors.primary },
  outOfStock: {
    ...typography.caption, color: colors.danger, fontWeight: "600",
    backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.pill, overflow: "hidden",
  },
});
