import { useEffect, useState, useCallback } from "react";
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Divider } from "@/components/Divider";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";
import { EmptyState } from "@/components/EmptyState";
import { OrderTimeline } from "@/components/OrderTimeline";
import { FadeInView } from "@/components/FadeInView";
import { marketplaceService, formatPrice } from "@/lib/marketplace-service";
import {
  ORDER_STATUS_LABELS,
  orderStatusLabel,
  ORDER_STATUS_TONE,
  PAYMENT_LABELS,
  orderItems,
  orderSubtotal,
  formatOrderDate,
} from "@/lib/order-display";
import { hapticWarning } from "@/lib/haptics";
import { useToast } from "@/providers/ToastProvider";
import { useConfirm } from "@/components/ConfirmDialog";
import { supabase } from "@/lib/supabase";
import type { MarketplaceOrder, OrderEvent, OrderStatus } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

const STEP = 55; // pas de l'apparition échelonnée


// Présentation du statut courant (hero) : icône, titre chaleureux, teinte.
const ORDER_STEPS: OrderStatus[] = ["pending", "confirmed", "preparing", "delivering", "completed"];
function heroFor(status: OrderStatus, pickup: boolean): { icon: keyof typeof Ionicons.glyphMap; title: string; sub?: string } {
  switch (status) {
    case "pending": return { icon: "receipt", title: "Commande bien reçue 💜", sub: "La boutique va la confirmer très vite." };
    case "confirmed": return { icon: "checkmark-circle", title: "Confirmée par la boutique ✅", sub: "Elle passe bientôt en préparation." };
    case "preparing": return { icon: "cube", title: "Préparée avec soin 📦", sub: pickup ? "Bientôt prête pour le retrait." : "Bientôt confiée au livreur." };
    case "delivering": return pickup
      ? { icon: "storefront", title: "Prête pour le retrait 🏬", sub: "Ta commande t'attend en boutique." }
      : { icon: "bicycle", title: "En route vers toi ! 🛵", sub: "Livraison prévue aujourd'hui." };
    case "completed": return { icon: "heart", title: pickup ? "Commande retirée 💜" : "Commande livrée 💜", sub: "Merci pour ton achat !" };
    default: return { icon: "close-circle", title: "Commande annulée" };
  }
}

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [order, setOrder] = useState<MarketplaceOrder | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    try {
      const [o, ev] = await Promise.all([
        marketplaceService.getOrder(id),
        marketplaceService.getOrderEvents(id).catch(() => [] as OrderEvent[]),
      ]);
      setOrder(o);
      setEvents(ev);
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Rechargement silencieux (sans spinner) pour le suivi en direct.
  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const [o, ev] = await Promise.all([
        marketplaceService.getOrder(id),
        marketplaceService.getOrderEvents(id).catch(() => [] as OrderEvent[]),
      ]);
      if (o) { setOrder(o); setEvents(ev); }
    } catch { /* on garde l'affichage courant */ }
  }, [id]);

  // TEMPS RÉEL : chaque étape validée par l'admin (nouvel order_event)
  // met à jour cet écran immédiatement, sans que la cliente ait à rafraîchir.
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`order-track-${id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "order_events", filter: `order_id=eq.${id}` },
        () => { refresh(); })
      // Aussi les UPDATE de la commande elle-même (is_paid, annulation admin…) :
      // certaines transitions ne génèrent pas forcément d'order_event.
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "marketplace_orders", filter: `id=eq.${id}` },
        () => { refresh(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, refresh]);

  // Numéro WhatsApp de la boutique (si activé dans les réglages).
  useEffect(() => {
    marketplaceService.getStorePaymentSettings()
      .then((st) => { if (st?.whatsapp_enabled && st.whatsapp_number) setWhatsapp(st.whatsapp_number); })
      .catch(() => {});
  }, []);

  if (loading) return <Loading />;
  if (!order) {
    return (
      <Screen>
        <ScreenHeader title="Reçu" />
        <EmptyState icon="receipt-outline" title="Commande introuvable" message="Cette commande n'est plus disponible." />
      </Screen>
    );
  }

  const items = orderItems(order.items);
  const subtotal = orderSubtotal(order.items);
  const delivery = Math.max(0, order.total_amount - subtotal);
  const isPickup = order.delivery_mode === "pickup";
  const deliveryLabel = isPickup ? "Retrait" : delivery === 0 ? "Gratuite" : formatPrice(delivery);
  const shortId = order.id.slice(0, 8).toUpperCase();

  async function shareReceipt() {
    const lines = items.map((it) => `• ${it.quantity} × ${it.name} — ${formatPrice(it.price * it.quantity)}`).join("\n");
    const msg =
      `Reçu Hygiena+ Store\n` +
      `Commande #${shortId} · ${formatOrderDate(order!.created_at)}\n\n` +
      `${lines}\n\n` +
      `Sous-total : ${formatPrice(subtotal)}\n` +
      `Livraison : ${deliveryLabel}\n` +
      `Total : ${formatPrice(order!.total_amount)}\n` +
      `Paiement : ${PAYMENT_LABELS[order!.payment_method ?? ""] ?? order!.payment_method ?? "—"} · ${order!.is_paid ? "Payé" : "À la livraison"}\n` +
      `Statut : ${ORDER_STATUS_LABELS[order!.status]}`;
    try {
      await Share.share({ message: msg });
    } catch {
      // partage annulé
    }
  }

  async function confirmCancel() {
    if (await confirm({ title: "Annuler la commande ?", message: "Cette action est définitive.", confirmLabel: "Annuler la commande", cancelLabel: "Retour", danger: true })) {
      setCancelling(true);
      hapticWarning();
      try {
        await marketplaceService.cancelOrder(order!.id);
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Annulation impossible");
      } finally {
        setCancelling(false);
      }
    }
  }

  return (
    <Screen>
      <View style={styles.fill}>
      <ScreenHeader
        title="Reçu"
        right={
          <Pressable onPress={shareReceipt} hitSlop={10} accessibilityRole="button" accessibilityLabel="Partager le reçu">
            <Ionicons name="share-social-outline" size={22} color={colors.text} />
          </Pressable>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* HERO : où en est ma commande, en une demi-seconde */}
        {order.status !== "cancelled" ? (
          <FadeInView fill={false} delay={0}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name={heroFor(order.status, isPickup).icon} size={30} color={colors.white} />
            </View>
            <Text style={styles.heroTitle}>{heroFor(order.status, isPickup).title}</Text>
            {heroFor(order.status, isPickup).sub ? <Text style={styles.heroSub}>{heroFor(order.status, isPickup).sub}</Text> : null}
            <View style={styles.progress}>
              {ORDER_STEPS.map((st, i) => {
                const cur = ORDER_STEPS.indexOf(order.status);
                return <View key={st} style={[styles.seg, i <= cur && styles.segDone]} />;
              })}
            </View>
          </View>
          </FadeInView>
        ) : null}

        {/* En-tête reçu */}
        <FadeInView fill={false} delay={0}>
        <Card style={styles.card}>
          <View style={styles.headRow}>
            <View>
              <Text style={styles.shopName}>Hygiena+ Store</Text>
              <Text style={styles.orderId}>Commande #{shortId}</Text>
              <Text style={styles.date}>{formatOrderDate(order.created_at)}</Text>
            </View>
            <Badge label={orderStatusLabel(order.status, order.delivery_mode)} tone={ORDER_STATUS_TONE[order.status]} soft />
          </View>
          <View style={styles.timelineWrap}>
            <OrderTimeline status={order.status} deliveryMode={order.delivery_mode} createdAt={order.created_at} updatedAt={order.updated_at} events={events} />
          </View>
        </Card>
        </FadeInView>

        {/* Articles + totaux */}
        <FadeInView fill={false} delay={STEP}>
        <Card style={styles.card}>
          <Text style={typography.h3}>Articles</Text>
          {items.map((it, i) => (
            <View key={`${it.product_id}-${i}`} style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={2}>{it.quantity} × {it.name}</Text>
              <Text style={styles.itemPrice}>{formatPrice(it.price * it.quantity)}</Text>
            </View>
          ))}
          <Divider spacing={spacing.xs} />
          <View style={styles.totRow}>
            <Text style={styles.totLabel}>Sous-total</Text>
            <Text style={styles.totVal}>{formatPrice(subtotal)}</Text>
          </View>
          <View style={styles.totRow}>
            <Text style={styles.totLabel}>Livraison{isPickup ? " (retrait)" : ""}</Text>
            <Text style={[styles.totVal, deliveryLabel === "Gratuite" && styles.free]}>{deliveryLabel}</Text>
          </View>
          <View style={[styles.totRow, styles.grandRow]}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandVal}>{formatPrice(order.total_amount)}</Text>
          </View>
        </Card>
        </FadeInView>

        {/* Paiement & réception */}
        <FadeInView fill={false} delay={STEP * 2}>
        <Card style={styles.card}>
          <Text style={typography.h3}>Détails</Text>
          <DetailLine icon="card-outline" label="Paiement" value={`${PAYMENT_LABELS[order.payment_method ?? ""] ?? order.payment_method ?? "—"} · ${order.is_paid ? "Payé" : "À la livraison"}`} />
          <DetailLine icon={isPickup ? "storefront-outline" : "bicycle-outline"} label="Réception" value={isPickup ? "Retrait en boutique" : `Livraison${order.neighborhood ? ` · ${order.neighborhood}` : ""}`} />
          <DetailLine icon="call-outline" label="Téléphone" value={order.phone} />
          {order.instructions ? <DetailLine icon="document-text-outline" label="Instructions" value={order.instructions} /> : null}
        </Card>
        </FadeInView>

        <FadeInView fill={false} delay={STEP * 3} style={styles.actionsBlock}>
          {whatsapp ? (
            <Button
              title="Contacter la boutique sur WhatsApp"
              onPress={() => {
                const num = whatsapp.replace(/[^0-9]/g, "");
                Linking.openURL(`https://wa.me/${num}?text=${encodeURIComponent(`Bonjour ! Ma commande #${shortId} :`)}`).catch(() => {});
              }}
            />
          ) : null}
          <Button title="Partager le reçu" variant="outline" onPress={shareReceipt} />
          {order.status === "pending" ? (
            <Pressable onPress={confirmCancel} disabled={cancelling} style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelPressed]} accessibilityRole="button" accessibilityLabel="Annuler la commande">
              <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.cancelText}>{cancelling ? "Annulation…" : "Annuler la commande"}</Text>
            </Pressable>
          ) : null}
        </FadeInView>
      </ScrollView>
      </View>
    </Screen>
  );
}

function DetailLine({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Hero de statut (dégradé doux lavande, pastille pleine, barre 5 segments)
  hero: { backgroundColor: colors.primaryLight, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center", gap: spacing.xs },
  heroIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs, shadowColor: colors.primaryDark, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  heroTitle: { ...typography.h3, textAlign: "center" },
  heroSub: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
  progress: { flexDirection: "row", gap: 5, alignSelf: "stretch", marginTop: spacing.sm },
  seg: { flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: "#E4DDEE" },
  segDone: { backgroundColor: colors.primary },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  actionsBlock: { gap: spacing.md },
  card: { gap: spacing.sm },
  headRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  shopName: { ...typography.h3, color: colors.primaryDark },
  orderId: { ...typography.caption, color: colors.text, fontWeight: "700" },
  date: { ...typography.caption, color: colors.textMuted },
  // Espace au-dessus du suivi vertical (séparation avec l'en-tête reçu).
  timelineWrap: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  itemRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  itemName: { ...typography.body, color: colors.text, flex: 1 },
  itemPrice: { ...typography.body, fontWeight: "600" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  totRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  totLabel: { ...typography.body, color: colors.textMuted },
  totVal: { ...typography.body, fontWeight: "600" },
  free: { color: colors.success, fontWeight: "700" },
  grandRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs },
  grandLabel: { ...typography.h3 },
  grandVal: { ...typography.h3, color: colors.primary },
  detailLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  detailLabel: { ...typography.caption, color: colors.textMuted, width: 86 },
  detailValue: { ...typography.body, color: colors.text, flex: 1 },
  cancelBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.sm },
  cancelPressed: { opacity: 0.55 },
  cancelText: { ...typography.body, color: colors.danger, fontWeight: "700" },
});
