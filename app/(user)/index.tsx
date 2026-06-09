import { useState, useCallback } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";
import { useCycles } from "@/hooks/useCycles";
import { useAuth } from "@/providers/AuthProvider";
import { cycleService } from "@/lib/cycle-service";
import { colors, spacing, typography } from "@/theme";

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

export default function CycleHome() {
  const { profile } = useAuth();
  const { cycles, prediction, loading, reload } = useCycles();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  async function onRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  function confirmDelete(id: string, dateLabel: string) {
    Alert.alert(
      "Supprimer ?",
      `Supprimer l'entrée du ${dateLabel} ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer", style: "destructive",
          onPress: async () => {
            try {
              await cycleService.deleteCycle(id);
              await reload();
            } catch (e) {
              Alert.alert("Erreur", e instanceof Error ? e.message : "Suppression échouée");
            }
          },
        },
      ]
    );
  }

  if (loading && cycles.length === 0) return <Loading />;

  const day = prediction?.currentDay;
  // "estimé" si on a moins de 2 cycles distincts (donc moyenne par défaut)
  const isEstimate = cycles.length < 2;

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.greeting}>Bonjour {profile?.full_name?.split(" ")[0] ?? ""} 👋</Text>

        <View style={styles.ring}>
          <View style={styles.ringInner}>
            {day ? (
              <>
                <Text style={styles.ringDay}>Jour {day}</Text>
                <Text style={styles.ringLabel}>de votre cycle</Text>
              </>
            ) : (
              <Text style={styles.ringLabel}>Enregistrez{"\n"}vos règles</Text>
            )}
          </View>
        </View>

        {prediction?.hasEnoughData ? (
          <Card style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={typography.h3}>Prédictions</Text>
              {isEstimate && <Text style={styles.badge}>estimé</Text>}
            </View>
            <Row label="Prochaines règles" value={formatDate(prediction.nextPeriodStart)} />
            <Row label="Ovulation estimée" value={formatDate(prediction.nextOvulation)} />
            <Row label="Fenêtre fertile" value={`${formatDate(prediction.fertileWindowStart)} – ${formatDate(prediction.fertileWindowEnd)}`} />
            <Row label="Cycle moyen" value={`${prediction.averageCycleLength} jours`} last />
            {isEstimate && (
              <Text style={styles.estimateNote}>
                Estimation basée sur un cycle de {prediction.averageCycleLength} jours.
                Enregistrez plus de cycles pour affiner.
              </Text>
            )}
          </Card>
        ) : (
          <Card style={styles.card}>
            <Text style={typography.h3}>Pas encore de prédictions</Text>
            <Text style={[typography.body, styles.muted]}>
              Enregistrez vos règles pour obtenir des prédictions personnalisées.
            </Text>
          </Card>
        )}

        <Button title="+ Enregistrer mes règles" onPress={() => router.push("/(user)/cycle/log")} />
        <Button title="Voir le calendrier" variant="outline" onPress={() => router.push("/(user)/cycle/calendar")} />

        {cycles.length > 0 && (
          <Card style={styles.card}>
            <Text style={typography.h3}>Historique récent</Text>
            {cycles.slice(0, 6).map((c) => {
              const dateLabel = new Date(c.period_start).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
              return (
                <View key={c.id} style={styles.histRow}>
                  <View style={styles.histLeft}>
                    <Text style={styles.rowLabel}>{dateLabel}</Text>
                    <Text style={styles.histSub}>
                      {c.symptoms && c.symptoms.length > 0 ? `${c.symptoms.length} symptôme(s)` : "Aucun symptôme"}
                    </Text>
                  </View>
                  <Pressable onPress={() => confirmDelete(c.id, dateLabel)} hitSlop={10} style={styles.trash}>
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </Pressable>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const RING = 200;
const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  greeting: { ...typography.h2 },
  ring: {
    alignSelf: "center", width: RING, height: RING, borderRadius: RING / 2,
    borderWidth: 12, borderColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center", marginVertical: spacing.md,
  },
  ringInner: { alignItems: "center" },
  ringDay: { fontSize: 34, fontWeight: "700", color: colors.primary },
  ringLabel: { ...typography.caption, textAlign: "center", marginTop: spacing.xs },
  card: { gap: spacing.sm, marginTop: spacing.xs },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: {
    ...typography.caption, color: colors.primaryDark, backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999, overflow: "hidden", fontWeight: "600",
  },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { ...typography.body, color: colors.textMuted },
  rowValue: { ...typography.body, fontWeight: "600" },
  muted: { color: colors.textMuted },
  estimateNote: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  histRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  histLeft: { gap: 2 },
  histSub: { ...typography.caption, color: colors.textMuted },
  trash: { padding: spacing.xs },
});
