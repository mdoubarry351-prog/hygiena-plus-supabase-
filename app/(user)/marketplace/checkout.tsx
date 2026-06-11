import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/providers/AuthProvider";
import { useCart } from "@/providers/CartProvider";
import { marketplaceService, formatPrice, type OrderItem } from "@/lib/marketplace-service";
import type { DeliveryMode } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

export default function Checkout() {
  const { session, profile } = useAuth();
  const { items, total, clear } = useCart();
  const router = useRouter();

  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [neighborhood, setNeighborhood] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("delivery");
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!session?.user) return;
    if (items.length === 0) {
      Alert.alert("Panier vide", "Ajoutez des produits avant de commander.");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Téléphone requis", "Veuillez saisir un numéro de téléphone.");
      return;
    }
    if (deliveryMode === "delivery" && !neighborhood.trim()) {
      Alert.alert("Quartier requis", "Indiquez votre quartier pour la livraison.");
      return;
    }

    const orderItems: OrderItem[] = items.map((it) => ({
      product_id: it.product.id,
      name: it.product.name,
      price: it.product.price,
      quantity: it.quantity,
    }));

    setSubmitting(true);
    try {
      await marketplaceService.createOrder({
        userId: session.user.id,
        phone: phone.trim(),
        neighborhood: deliveryMode === "delivery" ? neighborhood.trim() : null,
        deliveryMode,
        instructions: instructions.trim() ? instructions.trim() : null,
        items: orderItems,
        totalAmount: total,
      });
      clear();
      Alert.alert("Commande confirmée", "Votre commande a bien été enregistrée.", [
        { text: "OK", onPress: () => router.replace("/(user)/marketplace") },
      ]);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Commande échouée");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Commande" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        <Card style={styles.summaryCard}>
          <Text style={typography.h3}>Récapitulatif</Text>
          {items.map((it) => (
            <View key={it.product.id} style={styles.summaryRow}>
              <Text style={styles.summaryName} numberOfLines={1}>
                {it.quantity} × {it.product.name}
              </Text>
              <Text style={styles.summaryPrice}>{formatPrice(it.product.price * it.quantity)}</Text>
            </View>
          ))}
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(total)}</Text>
          </View>
        </Card>

        <Text style={[typography.h3, styles.sectionTitle]}>Mode de réception</Text>
        <View style={styles.modes}>
          <ModeOption
            label="Livraison"
            active={deliveryMode === "delivery"}
            onPress={() => setDeliveryMode("delivery")}
          />
          <ModeOption
            label="Retrait"
            active={deliveryMode === "pickup"}
            onPress={() => setDeliveryMode("pickup")}
          />
        </View>

        <Input
          label="Téléphone"
          value={phone}
          onChangeText={setPhone}
          placeholder="Ex. 06 12 34 56 78"
          keyboardType="phone-pad"
        />

        {deliveryMode === "delivery" && (
          <Input
            label="Quartier"
            value={neighborhood}
            onChangeText={setNeighborhood}
            placeholder="Votre quartier"
            autoCapitalize="words"
          />
        )}

        <Input
          label="Instructions (optionnel)"
          value={instructions}
          onChangeText={setInstructions}
          placeholder="Précisions sur la livraison ou le retrait"
          multiline
          numberOfLines={3}
          style={styles.notes}
        />

        <Button
          title={`Confirmer · ${formatPrice(total)}`}
          onPress={handleSubmit}
          loading={submitting}
          disabled={items.length === 0}
        />
        <Button title="Annuler" variant="outline" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

function ModeOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.mode, active && styles.modeActive]}>
      <Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  summaryCard: { gap: spacing.sm, marginBottom: spacing.sm },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  summaryName: { ...typography.body, color: colors.textMuted, flex: 1 },
  summaryPrice: { ...typography.body, fontWeight: "600" },
  summaryTotal: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs },
  totalLabel: { ...typography.h3 },
  totalValue: { ...typography.h3, color: colors.primary },
  sectionTitle: { marginTop: spacing.md, marginBottom: spacing.xs },
  modes: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  mode: {
    flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
  },
  modeActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  modeText: { ...typography.body, color: colors.text },
  modeTextActive: { color: colors.primaryDark, fontWeight: "600" },
  notes: { height: 90, textAlignVertical: "top", paddingTop: spacing.sm },
});
