import { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";
import { useCart } from "@/providers/CartProvider";
import { marketplaceService, formatPrice } from "@/lib/marketplace-service";
import type { MarketplaceProduct } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addItem } = useCart();

  const [product, setProduct] = useState<MarketplaceProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = await marketplaceService.getProduct(id);
        if (mounted) setProduct(p);
      } catch (e) {
        Alert.alert("Erreur", e instanceof Error ? e.message : "Produit introuvable", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <Loading />;
  if (!product) return null;

  const outOfStock = product.stock <= 0;
  const maxReached = quantity >= product.stock;

  function handleAddToCart() {
    if (!product) return;
    addItem(product, quantity);
    Alert.alert("Ajouté au panier", `${quantity} × ${product.name}`, [
      { text: "Continuer mes achats", style: "cancel", onPress: () => router.back() },
      { text: "Voir le panier", onPress: () => router.replace("/(user)/marketplace/cart") },
    ]);
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="bag-outline" size={48} color={colors.textMuted} />
          </View>
        )}

        <Text style={typography.h2}>{product.name}</Text>
        <Text style={styles.price}>{formatPrice(product.price)}</Text>

        {outOfStock ? (
          <Text style={styles.stockOut}>Rupture de stock</Text>
        ) : (
          <Text style={styles.stockIn}>En stock : {product.stock}</Text>
        )}

        {product.description ? (
          <Card style={styles.card}>
            <Text style={typography.h3}>Description</Text>
            <Text style={[typography.body, styles.descText]}>{product.description}</Text>
          </Card>
        ) : null}

        {!outOfStock && (
          <View style={styles.qtyBlock}>
            <Text style={[typography.h3, styles.qtyLabel]}>Quantité</Text>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                style={styles.stepBtn}
                hitSlop={8}
              >
                <Ionicons name="remove" size={20} color={colors.text} />
              </Pressable>
              <Text style={styles.qtyValue}>{quantity}</Text>
              <Pressable
                onPress={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                style={[styles.stepBtn, maxReached && styles.stepBtnDisabled]}
                hitSlop={8}
              >
                <Ionicons name="add" size={20} color={maxReached ? colors.textMuted : colors.text} />
              </Pressable>
            </View>
          </View>
        )}

        {outOfStock ? (
          <Button title="Indisponible" disabled />
        ) : (
          <Button title={`Ajouter au panier · ${formatPrice(product.price * quantity)}`} onPress={handleAddToCart} />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  image: { width: "100%", height: 240, borderRadius: radius.lg, backgroundColor: colors.surface },
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
  qtyValue: { ...typography.h3, minWidth: 28, textAlign: "center" },
});
