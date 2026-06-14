import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useCart } from "@/providers/CartProvider";
import {
  marketplaceService,
  formatPrice,
  computeDeliveryFee,
  codZoneAllowed,
  type OrderItem,
  type StorePaymentSettings,
} from "@/lib/marketplace-service";
import type { DeliveryMode } from "@/lib/database.types";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { colors, radius, spacing, typography } from "@/theme";

type PayMethod = "orange_money" | "mtn" | "cod" | "whatsapp";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function Checkout() {
  const { session, profile } = useAuth();
  const { items, total, clear } = useCart();
  const router = useRouter();
  const toast = useToast();

  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [neighborhood, setNeighborhood] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("delivery");
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Paiement
  const [store, setStore] = useState<StorePaymentSettings | null>(null);
  const [method, setMethod] = useState<PayMethod>("orange_money");
  const [payPhone, setPayPhone] = useState("+224 ");

  useEffect(() => {
    marketplaceService.getStorePaymentSettings().then(setStore).catch(() => setStore(null));
  }, []);

  const isMobileMoney = method === "orange_money" || method === "mtn";

  // Frais de livraison + total (livraison incluse).
  const delivery = computeDeliveryFee(store, neighborhood, total, deliveryMode);
  const grandTotal = total + delivery.fee;
  const threshold = store?.free_delivery_threshold ?? null;
  // Combien manque-t-il pour la livraison gratuite (mode livraison, seuil non atteint).
  const remainingForFree =
    deliveryMode === "delivery" && threshold != null && !delivery.free && total < threshold
      ? threshold - total
      : null;

  // COD : activé + sous plafond + (si zones définies) quartier autorisé en livraison.
  const codZoneOk = deliveryMode !== "delivery" || codZoneAllowed(store, neighborhood);
  const codAvailable =
    !!store?.cod_enabled &&
    (store.cod_max_amount == null || grandTotal <= store.cod_max_amount) &&
    codZoneOk;
  const whatsappAvailable = !!store?.whatsapp_enabled && !!store?.whatsapp_number;

  const payOptions: { key: PayMethod; label: string; sub?: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "orange_money", label: "Orange Money", sub: "Mobile Money", icon: "phone-portrait-outline" },
    { key: "mtn", label: "MTN Money", sub: "Mobile Money", icon: "phone-portrait-outline" },
    ...(codAvailable ? [{ key: "cod" as const, label: "Paiement à la livraison", icon: "cash-outline" as const }] : []),
    ...(whatsappAvailable ? [{ key: "whatsapp" as const, label: "Commander via WhatsApp", icon: "logo-whatsapp" as const }] : []),
  ];

  // Si le mode sélectionné n'est plus disponible (ex. COD masqué par zone), on revient au Mobile Money.
  useEffect(() => {
    if (!payOptions.some((o) => o.key === method)) setMethod("orange_money");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codAvailable, whatsappAvailable]);

  function openWhatsApp() {
    const num = (store?.whatsapp_number ?? "").replace(/[^\d]/g, "");
    const lines = items.map((it) => `• ${it.quantity} × ${it.product.name}`).join("\n");
    const livraison = deliveryMode === "delivery" ? `\nLivraison : ${delivery.free ? "Gratuite" : formatPrice(delivery.fee)}` : "";
    const msg = `Bonjour, je souhaite commander :\n${lines}\nSous-total : ${formatPrice(total)}${livraison}\nTotal : ${formatPrice(grandTotal)}\nTéléphone : ${phone.trim()}`;
    Linking.openURL(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`).catch(() =>
      Alert.alert("WhatsApp indisponible", "Impossible d'ouvrir WhatsApp sur cet appareil.")
    );
  }

  async function handleSubmit() {
    if (!session?.user) return;
    if (items.length === 0) { Alert.alert("Panier vide", "Ajoutez des produits avant de commander."); return; }
    if (!phone.trim()) { Alert.alert("Téléphone requis", "Veuillez saisir un numéro de téléphone."); return; }
    if (deliveryMode === "delivery" && !neighborhood.trim()) {
      Alert.alert("Quartier requis", "Indiquez votre quartier pour la livraison.");
      return;
    }

    if (method === "whatsapp") { openWhatsApp(); return; }

    if (isMobileMoney && !payPhone.trim()) {
      Alert.alert("Numéro requis", "Saisissez le numéro Mobile Money pour payer.");
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
      if (isMobileMoney) await sleep(1300); // simulation du paiement Mobile Money

      await marketplaceService.createOrder({
        userId: session.user.id,
        phone: phone.trim(),
        neighborhood: deliveryMode === "delivery" ? neighborhood.trim() : null,
        deliveryMode,
        instructions: instructions.trim() ? instructions.trim() : null,
        items: orderItems,
        totalAmount: grandTotal,
        paymentMethod: method,
        paymentPhone: isMobileMoney ? payPhone.trim() : null,
        isPaid: isMobileMoney,
      });
      clear();
      hapticSuccess();
      toast.success(isMobileMoney ? "Paiement réussi 🎉 Commande créée." : "Commande confirmée — paiement à la livraison.");
      router.replace("/(user)/marketplace");
    } catch (e) {
      hapticError();
      Alert.alert("Erreur", e instanceof Error ? e.message : "Commande échouée");
    } finally {
      setSubmitting(false);
    }
  }

  const payLabel =
    method === "whatsapp" ? "Commander via WhatsApp"
    : method === "cod" ? `Confirmer · ${formatPrice(grandTotal)}`
    : `Payer ${formatPrice(grandTotal)}`;

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
          <View style={[styles.summaryRow, styles.summarySub]}>
            <Text style={styles.summaryName}>Sous-total</Text>
            <Text style={styles.summaryPrice}>{formatPrice(total)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryName}>Livraison{deliveryMode === "pickup" ? " (retrait)" : ""}</Text>
            <Text style={[styles.summaryPrice, delivery.free && styles.freeText]}>
              {deliveryMode === "pickup" || delivery.fee === 0
                ? delivery.free ? "Gratuite" : "—"
                : formatPrice(delivery.fee)}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(grandTotal)}</Text>
          </View>
          {remainingForFree != null ? (
            <Text style={styles.freeHint}>Plus que {formatPrice(remainingForFree)} pour la livraison gratuite 🎉</Text>
          ) : null}
        </Card>

        <Text style={[typography.h3, styles.sectionTitle]}>Mode de réception</Text>
        <View style={styles.modes}>
          <ModeOption label="Livraison" active={deliveryMode === "delivery"} onPress={() => setDeliveryMode("delivery")} />
          <ModeOption label="Retrait" active={deliveryMode === "pickup"} onPress={() => setDeliveryMode("pickup")} />
        </View>

        <Input
          label="Téléphone"
          value={phone}
          onChangeText={setPhone}
          placeholder="Ex. 620 00 00 00"
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

        {/* Mode de paiement */}
        <Text style={[typography.h3, styles.sectionTitle]}>Mode de paiement</Text>
        {payOptions.map((o) => {
          const active = method === o.key;
          return (
            <Pressable key={o.key} onPress={() => setMethod(o.key)} style={[styles.payRow, active && styles.payRowActive]}>
              <View style={[styles.payIcon, active && styles.payIconActive]}>
                <Ionicons name={o.icon} size={20} color={active ? colors.primaryDark : colors.textMuted} />
              </View>
              <View style={styles.payInfo}>
                <Text style={styles.payLabel}>{o.label}</Text>
                {o.sub ? <Text style={styles.paySub}>{o.sub}</Text> : null}
              </View>
              <Ionicons
                name={active ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={active ? colors.primary : colors.textMuted}
              />
            </Pressable>
          );
        })}

        {isMobileMoney && (
          <Input
            label="Numéro Mobile Money"
            value={payPhone}
            onChangeText={setPayPhone}
            placeholder="+224 620 00 00 00"
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
        )}

        <Text style={styles.simNote}>Paiement simulé — aucune transaction réelle n'est effectuée.</Text>

        <Button
          title={submitting && isMobileMoney ? "Paiement en cours…" : payLabel}
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
  summarySub: { marginTop: spacing.xs },
  summaryTotal: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs },
  totalLabel: { ...typography.h3 },
  totalValue: { ...typography.h3, color: colors.primary },
  freeText: { color: colors.success, fontWeight: "700" },
  freeHint: { ...typography.caption, color: colors.primaryDark, fontWeight: "600", marginTop: spacing.xs },
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
  // Paiement
  payRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card,
  },
  payRowActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  payIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  payIconActive: { backgroundColor: colors.white },
  payInfo: { flex: 1, gap: 2 },
  payLabel: { ...typography.name },
  paySub: { ...typography.caption, color: colors.textMuted },
  simNote: { ...typography.caption, color: colors.textMuted, fontStyle: "italic", marginTop: spacing.xs },
});
