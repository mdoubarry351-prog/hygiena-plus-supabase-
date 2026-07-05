import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";
import { EmptyState } from "@/components/EmptyState";
import { OfflineBanner } from "@/components/OfflineBanner";
import { FadeInView } from "@/components/FadeInView";
import { useCycles } from "@/hooks/useCycles";
import { deleteCycleSmart } from "@/lib/cycle-offline";
import { cycleService } from "@/lib/cycle-service";
import { resyncCycleReminders } from "@/lib/reminders";
import { hapticLight } from "@/lib/haptics";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useConfirm } from "@/components/ConfirmDialog";
import type { MenstrualCycle } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

const PAGE = 12;
const STEP = 55; // pas de l'apparition échelonnée (cohérent Vague 1)

function startTime(c: MenstrualCycle): number {
  return new Date(c.period_start).getTime();
}
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
function formatDay(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = arr.reduce((s, n) => s + n, 0) / arr.length;
  const v = arr.reduce((s, n) => s + (n - m) ** 2, 0) / arr.length;
  return Math.sqrt(v);
}
function painDescriptor(p: number): string {
  if (p === 0) return "aucune";
  if (p <= 3) return "légère";
  if (p <= 6) return "modérée";
  if (p <= 9) return "forte";
  return "intense";
}

export default function CycleHistory() {
  const { cycles, loading, offline, cachedAt, reload } = useCycles();
  const { session } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [visible, setVisible] = useState(PAGE);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Durée du cycle (écart jusqu'au cycle suivant) + détection d'irrégularité,
  // calculées sur l'ordre chronologique (ascendant), réutilisées en affichage desc.
  const { cycleLenById, isIrregular } = useMemo(() => {
    const asc = [...cycles].sort((a, b) => startTime(a) - startTime(b));
    const lenById = new Map<string, number | null>();
    for (let i = 0; i < asc.length; i++) {
      const next = asc[i + 1];
      lenById.set(asc[i].id, next ? daysBetween(asc[i].period_start, next.period_start) : null);
    }
    const lens = [...lenById.values()].filter((l): l is number => l != null && l >= 5 && l <= 90);
    const mean = lens.length ? lens.reduce((s, n) => s + n, 0) / lens.length : 0;
    const std = stddev(lens);
    const threshold = Math.max(3, Math.round(std)); // même seuil de base (3 j) que le résumé
    const canAssess = lens.length >= 2;
    const irregular = (len: number | null) =>
      canAssess && len != null && len >= 5 && len <= 90 && Math.abs(len - mean) > threshold;
    return { cycleLenById: lenById, isIrregular: irregular };
  }, [cycles]);

  const sortedDesc = useMemo(
    () => [...cycles].sort((a, b) => startTime(b) - startTime(a)),
    [cycles]
  );

  async function confirmDelete(c: MenstrualCycle) {
    const ok = await confirm({
      title: "Supprimer cette saisie ?",
      message: `Règles du ${formatDay(c.period_start)}. Cette action est définitive.`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    setDeleting(c.id);
    try {
      const { queued } = await deleteCycleSmart(session!.user.id, c.id);
      await reload();
      if (session?.user) resyncCycleReminders(session.user.id); // replanifie (silencieux)
      toast.success(queued ? "Suppression enregistrée hors-ligne — synchronisation au retour du réseau 📶" : "Saisie supprimée.");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Suppression échouée");
    } finally {
      setDeleting(null);
    }
  }

  if (loading && cycles.length === 0) return <Loading />;

  return (
    <Screen>
      <ScreenHeader title="Historique des cycles" />
      {cycles.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="Aucun cycle enregistré"
          message="Enregistre tes règles pour retrouver ici tout ton historique."
          actionLabel="Enregistrer mes règles"
          onAction={() => router.push("/(user)/cycle/log")}
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {offline ? <OfflineBanner cachedAt={cachedAt} /> : null}
          <Text style={styles.count}>{cycles.length} cycle{cycles.length > 1 ? "s" : ""} enregistré{cycles.length > 1 ? "s" : ""}</Text>

          {sortedDesc.slice(0, visible).map((c, i) => {
            const periodLen = c.period_end ? daysBetween(c.period_start, c.period_end) + 1 : null;
            const cycleLen = cycleLenById.get(c.id) ?? null;
            const irregular = isIrregular(cycleLen);
            const recap: string[] = [];
            if (c.flow) recap.push(c.flow);
            if (c.mood) recap.push(c.mood);
            if (c.pain != null) recap.push(`Douleur ${c.pain}/10 · ${painDescriptor(c.pain)}`);
            if (c.symptoms && c.symptoms.length) recap.push(`${c.symptoms.length} symptôme${c.symptoms.length > 1 ? "s" : ""}`);

            return (
              <FadeInView key={c.id} fill={false} delay={Math.min(i, 6) * STEP}>
              <Card style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.dateWrap}>
                    <Ionicons name="water" size={16} color={colors.primary} />
                    <Text style={styles.dateText}>
                      {formatDay(c.period_start)}{c.period_end ? ` → ${formatDay(c.period_end)}` : ""}
                    </Text>
                  </View>
                  {irregular ? (
                    <View style={styles.irregBadge}>
                      <Ionicons name="pulse" size={12} color={colors.white} />
                      <Text style={styles.irregText}>Irrégulier</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.metaRow}>
                  {periodLen != null ? <MetaPill icon="time-outline" label={`${periodLen} j de règles`} /> : null}
                  <MetaPill icon="sync-outline" label={cycleLen != null ? `${cycleLen} j de cycle` : "Cycle en cours"} />
                </View>

                {recap.length > 0 ? <Text style={styles.recap}>{recap.join(" · ")}</Text> : null}
                {c.notes ? <Text style={styles.notes} numberOfLines={2}>« {c.notes} »</Text> : null}

                <View style={styles.actions}>
                  <Pressable onPress={() => { hapticLight(); router.push({ pathname: "/(user)/cycle/log", params: { id: c.id } }); }} style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]} hitSlop={6} accessibilityRole="button" accessibilityLabel="Modifier la saisie">
                    <Ionicons name="create-outline" size={18} color={colors.primary} />
                    <Text style={styles.actionText}>Modifier</Text>
                  </Pressable>
                  <Pressable onPress={() => { hapticLight(); confirmDelete(c); }} disabled={deleting === c.id} style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]} hitSlop={6} accessibilityRole="button" accessibilityLabel="Supprimer la saisie">
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    <Text style={[styles.actionText, styles.actionDanger]}>{deleting === c.id ? "Suppression…" : "Supprimer"}</Text>
                  </Pressable>
                </View>
              </Card>
              </FadeInView>
            );
          })}

          {visible < sortedDesc.length ? (
            <Button title="Charger plus" variant="outline" onPress={() => setVisible((v) => v + PAGE)} />
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

function MetaPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.pill}>
      <Ionicons name={icon} size={13} color={colors.textMuted} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  count: { ...typography.caption, color: colors.textMuted, fontWeight: "700" },
  card: { gap: spacing.sm },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  dateWrap: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flex: 1 },
  dateText: { ...typography.name, color: colors.text },
  irregBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  irregText: { ...typography.caption, fontSize: 11, color: colors.white, fontWeight: "700" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  pill: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  recap: { ...typography.caption, color: colors.text },
  notes: { ...typography.caption, color: colors.textMuted, fontStyle: "italic" },
  actions: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  actionPressed: { opacity: 0.55 },
  actionText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  actionDanger: { color: colors.danger },
});
