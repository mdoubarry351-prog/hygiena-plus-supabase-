import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { AppImage } from "@/components/AppImage";
import { useCart, type CartItem } from "@/providers/CartProvider";
import { formatPrice } from "@/lib/marketplace-service";
import { colors, radius, spacing, typography } from "@/theme";

export default function Cart() {
  const { items, total, setQuantity, removeItem } = useCart();
  const router = useRouter();

  return (
    <Screen>
      <ScreenHeader title="Mon panier" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {items.length === 0 ? (
          <EmptyState
            icon="cart-outline"
            title="Votre panier est vide"
            message="Parcourez la boutique pour ajouter des produits."
            actionLabel="Voir la boutique"
            onAction={() => router.replace("/(user)/marketplace")}
          />
        ) : (
          <>
            {items.map((it) => (
              <CartRow
                key={it.product.id}
                item={it}
                onIncrease={() => setQuantity(it.product.id, it.quantity + 1)}
                onDecrease={() => setQuantity(it.product.id, it.quantity - 1)}
                onRemove={() => removeItem(it.product.id)}
              />
            ))}

            <Card style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPrice(total)}</Text>
            </Card>

            <Button title="Passer la commande" onPress={() => router.push("/(user)/marketplace/checkout")} />
            <Button title="Continuer mes achats" variant="outline" onPress={() => router.replace("/(user)/marketplace")} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function CartRow({
  item,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  item: CartItem;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
}) {
  const { product, quantity } = item;
  const maxReached = quantity >= product.stock;
  return (
    <Card style={styles.row}>
      {product.image_url ? (
        <AppImage source={product.image_url} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="bag-outline" size={24} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.price}>{formatPrice(product.price * quantity)}</Text>
        <View style={styles.stepper}>
          <Pressable onPress={onDecrease} style={styles.stepBtn} hitSlop={8}>
            <Ionicons name="remove" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.qtyValue}>{quantity}</Text>
          <Pressable onPress={onIncrease} style={[styles.stepBtn, maxReached && styles.stepBtnDisabled]} hitSlop={8}>
            <Ionicons name="add" size={18} color={maxReached ? colors.textMuted : colors.text} />
          </Pressable>
        </View>
      </View>
      <Pressable onPress={onRemove} hitSlop={10} style={styles.trash}>
        <Ionicons name="trash-outline" size={20} color={colors.danger} />
      </Pressable>
    </Card>
  );
}

const THUMB = 64;
const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  empty: { alignItems: "center", gap: spacing.sm },
  muted: { color: colors.textMuted, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.md, backgroundColor: colors.surface },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  info: { flex: 1, gap: spacing.xs },
  name: { ...typography.name },
  price: { ...typography.body, fontWeight: "700", color: colors.primary },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xs },
  stepBtn: {
    width: 34, height: 34, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
  },
  stepBtnDisabled: { opacity: 0.5 },
  qtyValue: { ...typography.body, fontWeight: "600", minWidth: 22, textAlign: "center" },
  trash: { padding: spacing.xs },
  totalCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  totalLabel: { ...typography.h3 },
  totalValue: { ...typography.h2, color: colors.primary },
});
