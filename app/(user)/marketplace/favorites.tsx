import { useCallback, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Loading } from "@/components/Loading";
import { StarRating } from "@/components/StarRating";
import { favoritesService } from "@/lib/favorites-service";
import { formatPrice } from "@/lib/marketplace-service";
import type { MarketplaceProduct } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

export default function Favorites() {
  const router = useRouter();
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setProducts(await favoritesService.getFavoriteProducts());
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // Retrait optimiste de la liste.
  async function removeFav(id: string) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    try {
      await favoritesService.removeFavorite(id);
    } catch {
      await load();
    }
  }

  if (loading && products.length === 0) return <Loading />;

  return (
    <Screen>
      <ScreenHeader title="Mes favoris" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {products.length === 0 ? (
          <EmptyState
            icon="heart-outline"
            title="Aucun favori pour le moment"
            message="Touchez le cœur sur un produit pour l'ajouter ici."
          />
        ) : (
          products.map((p) => {
            const outOfStock = p.stock <= 0;
            return (
              <Pressable key={p.id} onPress={() => router.push(`/(user)/marketplace/${p.id}`)}>
                <Card style={styles.row}>
                  {p.image_url ? (
                    <Image source={{ uri: p.image_url }} style={styles.thumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Ionicons name="bag-outline" size={26} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.rowInfo}>
                    <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                    {p.rating_count > 0 ? (
                      <StarRating value={p.rating_avg} count={p.rating_count} size={13} compact />
                    ) : null}
                    <View style={styles.rowFoot}>
                      <Text style={styles.price}>{formatPrice(p.price)}</Text>
                      {outOfStock && <Text style={styles.outOfStock}>Rupture</Text>}
                    </View>
                  </View>
                  <Pressable onPress={() => removeFav(p.id)} hitSlop={10} style={styles.favBtn}>
                    <Ionicons name="heart" size={22} color={colors.danger} />
                  </Pressable>
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const THUMB = 80;
const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.md, backgroundColor: colors.surface },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1, gap: 4 },
  name: { ...typography.name },
  rowFoot: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  price: { ...typography.body, fontWeight: "700", color: colors.primary },
  outOfStock: { ...typography.caption, color: colors.danger, fontWeight: "700" },
  favBtn: { padding: spacing.xs },
});
