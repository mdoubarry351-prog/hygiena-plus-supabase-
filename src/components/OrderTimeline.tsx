import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { OrderStatus, DeliveryMode, OrderEvent } from "@/lib/database.types";
import { formatOrderDateShort } from "@/lib/order-display";
import { colors, radius, spacing, typography } from "@/theme";

type StepDef = { key: OrderStatus; label: string; icon: keyof typeof Ionicons.glyphMap };

// Étapes du suivi (cancelled exclu — état distinct). Libellés des 2 dernières
// étapes adaptés au mode : livraison (« Expédiée »/« Livrée ») vs retrait
// (« Prête pour retrait »/« Retirée »).
function orderSteps(mode: DeliveryMode): StepDef[] {
  const pickup = mode === "pickup";
  return [
    { key: "pending", label: "En attente de confirmation", icon: "receipt-outline" },
    { key: "confirmed", label: "Confirmée", icon: "checkmark-circle-outline" },
    { key: "preparing", label: "En préparation", icon: "cube-outline" },
    { key: "delivering", label: pickup ? "Prête pour retrait" : "Expédiée", icon: pickup ? "storefront-outline" : "bicycle-outline" },
    { key: "completed", label: pickup ? "Retirée" : "Livrée", icon: pickup ? "bag-check-outline" : "checkmark-done-outline" },
  ];
}

// Libellé + icône de l'étape courante (pour la ligne compacte de la liste).
export function orderStepInfo(status: OrderStatus, mode: DeliveryMode): { label: string; icon: keyof typeof Ionicons.glyphMap } {
  if (status === "cancelled") return { label: "Commande annulée", icon: "close-circle-outline" };
  const steps = orderSteps(mode);
  return steps.find((s) => s.key === status) ?? steps[0];
}

// Suivi de commande façon « order tracking » : stepper VERTICAL. Étape courante
// mise en valeur (pastille primary pleine), étapes passées cochées, futures grisées.
export function OrderTimeline({
  status,
  deliveryMode = "delivery",
  createdAt,
  updatedAt,
  events,
}: {
  status: OrderStatus;
  deliveryMode?: DeliveryMode;
  createdAt?: string;
  updatedAt?: string;
  // Historique horodaté (order_events) : quand fourni, CHAQUE étape franchie
  // affiche son heure réelle (et plus seulement la première/courante).
  events?: OrderEvent[];
}) {
  // Annulée = état dédié (hors stepper).
  if (status === "cancelled") {
    return (
      <View style={styles.cancelled}>
        <Ionicons name="close-circle" size={20} color={colors.danger} />
        <View style={styles.cancelledBody}>
          <Text style={styles.cancelledTitle}>Commande annulée</Text>
          {updatedAt ? <Text style={styles.cancelledDate}>Le {formatOrderDateShort(updatedAt)}</Text> : null}
        </View>
      </View>
    );
  }

  const steps = orderSteps(deliveryMode);
  const currentIndex = steps.findIndex((s) => s.key === status);

  return (
    <View style={styles.list}>
      {steps.map((s, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        const future = i > currentIndex;
        const isLast = i === steps.length - 1;
        // Heure réelle de l'étape depuis l'historique (dernier événement de ce
        // statut) ; repli sur création/màj si l'historique n'est pas fourni.
        const ev = events?.filter((e) => e.status === s.key).at(-1);
        const date = ev?.created_at ?? (i === 0 ? createdAt : current ? updatedAt : undefined);
        return (
          <View key={s.key} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.node, done && styles.nodeDone, current && styles.nodeCurrent, future && styles.nodeFuture]}>
                {done ? (
                  <Ionicons name="checkmark" size={13} color={colors.white} />
                ) : (
                  <Ionicons name={s.icon} size={13} color={current ? colors.white : colors.textMuted} />
                )}
              </View>
              {!isLast ? <View style={[styles.connector, i < currentIndex ? styles.connectorDone : styles.connectorTodo]} /> : null}
            </View>
            <View style={[styles.body, !isLast && styles.bodyGap]}>
              <Text style={[styles.label, current && styles.labelCurrent, future && styles.labelFuture]}>{s.label}</Text>
              {date ? <Text style={styles.date}>{formatOrderDateShort(date)}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  row: { flexDirection: "row", alignItems: "stretch", gap: spacing.sm },
  rail: { width: 28, alignItems: "center" },
  node: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  nodeDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  nodeCurrent: { backgroundColor: colors.primary, borderColor: colors.primaryLight, borderWidth: 3 },
  nodeFuture: { backgroundColor: colors.surface, borderColor: colors.border },
  connector: { flex: 1, width: 2, marginVertical: 2, borderRadius: 1, minHeight: 14 },
  connectorDone: { backgroundColor: colors.primary },
  connectorTodo: { backgroundColor: colors.border },
  body: { flex: 1, paddingTop: 4 },
  bodyGap: { paddingBottom: spacing.md },
  label: { ...typography.body, color: colors.text, fontWeight: "600" },
  labelCurrent: { color: colors.primaryDark, fontWeight: "700" },
  labelFuture: { color: colors.textMuted, fontWeight: "400" },
  date: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  // Annulée
  cancelled: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.dangerSoft, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  cancelledBody: { flex: 1, gap: 1 },
  cancelledTitle: { ...typography.name, color: colors.danger },
  cancelledDate: { ...typography.caption, color: colors.danger },
});
