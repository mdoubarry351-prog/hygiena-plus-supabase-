import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { OrderStatus } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

// Étapes de progression (cancelled exclu — état distinct).
const STEPS: { key: OrderStatus; label: string }[] = [
  { key: "pending", label: "En attente" },
  { key: "confirmed", label: "Confirmée" },
  { key: "preparing", label: "En préparation" },
  { key: "delivering", label: "Expédiée" },
  { key: "completed", label: "Livrée" },
];

// Suivi visuel étape par étape (stepper horizontal). Annulée = état distinct.
export function OrderTimeline({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <View style={styles.cancelledRow}>
        <Ionicons name="close-circle" size={18} color={colors.danger} />
        <Text style={styles.cancelledText}>Commande annulée</Text>
      </View>
    );
  }
  const currentIndex = STEPS.findIndex((s) => s.key === status);
  return (
    <View style={styles.timeline}>
      <View style={styles.stepper}>
        {STEPS.map((s, i) => {
          const reached = i <= currentIndex;
          const done = i < currentIndex;
          const current = i === currentIndex;
          return (
            <View key={s.key} style={[styles.segment, i > 0 && styles.segmentGrow]}>
              {i > 0 ? <View style={[styles.line, i <= currentIndex ? styles.lineDone : styles.lineTodo]} /> : null}
              <View style={[styles.node, reached && styles.nodeReached, current && styles.nodeCurrent]}>
                {done ? <Ionicons name="checkmark" size={12} color={colors.white} /> : null}
              </View>
            </View>
          );
        })}
      </View>
      <Text style={styles.currentLabel}>
        Étape actuelle : <Text style={styles.currentLabelStrong}>{STEPS[currentIndex]?.label ?? "—"}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: { gap: spacing.xs },
  stepper: { flexDirection: "row", alignItems: "center" },
  segment: { flexDirection: "row", alignItems: "center" },
  segmentGrow: { flex: 1 },
  line: { flex: 1, height: 2, marginHorizontal: 4, borderRadius: 1 },
  lineDone: { backgroundColor: colors.primary },
  lineTodo: { backgroundColor: colors.border },
  node: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" },
  nodeReached: { backgroundColor: colors.primary },
  nodeCurrent: { width: 26, height: 26, borderRadius: 13, borderWidth: 3, borderColor: colors.primaryLight },
  currentLabel: { ...typography.caption, color: colors.textMuted },
  currentLabelStrong: { color: colors.primaryDark, fontWeight: "700" },
  cancelledRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: "#FFF1F4", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md },
  cancelledText: { ...typography.caption, color: colors.danger, fontWeight: "700" },
});
