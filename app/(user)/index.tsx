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
import { notificationsService } from "@/lib/notifications-service";
import { colors, radius, spacing, typography } from "@/theme";

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

// Message bienveillant du jour, dérivé de la phase du cycle quand l'info est
// disponible (présentation uniquement, à partir des données déjà chargées).
function dailyMessage(day: number | null | undefined, avg: number | null | undefined): string {
  if (!day || !avg) return "Prends un moment pour toi aujourd'hui. 🌿";
  const ovulation = Math.max(10, avg - 14);
  if (day <= 5) return "Phase menstruelle — accorde-toi repos et douceur. 💗";
  if (day < ovulation - 1) return "Phase folliculaire — ton énergie remonte, profites-en. 🌱";
  if (day <= ovulation + 1) return "Autour de l'ovulation — tu rayonnes aujourd'hui. ✨";
  return "Phase lutéale — écoute tes besoins, sois indulgente avec toi. 🌙";
}

export default function CycleHome() {
  const { profile, session } = useAuth();
  const { cycles, prediction, loading, reload } = useCycles();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);

  const loadUnread = useCallback(async () => {
    if (!session?.user) return;
    try {
      setUnread(await notificationsService.getUnreadCount(session.user.id));
    } catch {
      // Compteur non bloquant : on ignore l'erreur.
    }
  }, [session?.user]);

  useFocusEffect(useCallback(() => { reload(); loadUnread(); }, [reload, loadUnread]));

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([reload(), loadUnread()]);
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

  // Salutation chaleureuse selon l'heure (présentation uniquement).
  const hour = new Date().getHours();
  const isEvening = hour >= 18 || hour < 5;
  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const greetingText = `${isEvening ? "Bonsoir" : "Bonjour"}${firstName ? " " + firstName : ""} ${isEvening ? "🌙" : "🌿"}`;
  const dayMessage = dailyMessage(day, prediction?.averageCycleLength);

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.greeting} numberOfLines={1}>
          {greetingText}
        </Text>
        <Pressable onPress={() => router.push("/(user)/notifications")} hitSlop={10} style={styles.bellBtn}>
          <Ionicons name="notifications-outline" size={26} color={colors.text} />
          {unread > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unread > 99 ? "99+" : unread}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.ringOuter}>
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

        <View style={styles.dayMsg}>
          <Text style={styles.dayMsgText}>{dayMessage}</Text>
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
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.lg, gap: spacing.sm },
  greeting: { ...typography.h2, flex: 1 },
  bellBtn: { padding: spacing.xs },
  bellBadge: {
    position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
  bellBadgeText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  ringOuter: {
    alignSelf: "center", width: RING, height: RING, borderRadius: RING / 2,
    backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
    marginTop: spacing.md, marginBottom: spacing.sm,
    shadowColor: colors.primaryDark, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },
  ringInner: {
    width: RING - 42, height: RING - 42, borderRadius: (RING - 42) / 2,
    backgroundColor: colors.white, alignItems: "center", justifyContent: "center",
  },
  ringDay: { fontSize: 32, fontWeight: "700", color: colors.primaryDark },
  ringLabel: { ...typography.caption, textAlign: "center", marginTop: spacing.xs },
  dayMsg: {
    alignSelf: "stretch", backgroundColor: colors.primaryLight, borderRadius: radius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.xs,
  },
  dayMsgText: { ...typography.body, color: colors.primaryDark, textAlign: "center" },
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
