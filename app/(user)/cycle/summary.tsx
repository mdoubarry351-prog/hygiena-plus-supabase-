import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { CycleRing } from "@/components/CycleRing";
import { Loading } from "@/components/Loading";
import { EmptyState } from "@/components/EmptyState";
import { useCycles } from "@/hooks/useCycles";
import { colors, radius, spacing, typography } from "@/theme";

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = arr.reduce((s, n) => s + n, 0) / arr.length;
  const v = arr.reduce((s, n) => s + (n - m) ** 2, 0) / arr.length;
  return Math.sqrt(v);
}

export default function CycleSummary() {
  const { cycles, prediction, loading } = useCycles();

  if (loading && cycles.length === 0) return <Loading />;

  // Pas assez de données → message bienveillant.
  if (cycles.length < 2) {
    return (
      <Screen>
        <ScreenHeader title="Résumé de mon cycle" />
        <EmptyState
          icon="sparkles-outline"
          title="Bientôt ton résumé"
          message="Enregistre quelques cycles pour voir ton résumé (durée moyenne, régularité, symptômes…)."
        />
      </Screen>
    );
  }

  // --- Calculs à partir des données déjà chargées (aucune requête) ---
  const sorted = [...cycles].sort(
    (a, b) => new Date(a.period_start).getTime() - new Date(b.period_start).getTime()
  );

  // Écarts entre débuts consécutifs (mêmes bornes que la prédiction : 5–90 j).
  const cycleLengths: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const len = daysBetween(sorted[i - 1].period_start, sorted[i].period_start);
    if (len >= 5 && len <= 90) cycleLengths.push(len);
  }
  // Durées de règles (si period_end renseigné).
  const periodLengths: number[] = [];
  for (const c of sorted) {
    if (c.period_end) {
      const len = daysBetween(c.period_start, c.period_end) + 1;
      if (len > 0 && len < 15) periodLengths.push(len);
    }
  }

  // Symptômes les plus fréquents (agrégés depuis symptoms[]).
  const counts = new Map<string, number>();
  for (const c of cycles) for (const s of c.symptoms ?? []) counts.set(s, (counts.get(s) ?? 0) + 1);
  const topSymptoms = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Régularité (variance des durées de cycle ; ≥ 2 écarts requis).
  const std = stddev(cycleLengths);
  const canAssessRegularity = cycleLengths.length >= 2;
  const isRegular = std <= 3;

  // Période couverte.
  const firstStart = sorted[0].period_start;
  const lastStart = sorted[sorted.length - 1].period_start;

  // Anneau (mêmes dérivations que l'accueil).
  const ringN = prediction?.averageCycleLength ?? 28;
  const periodLen = prediction?.averagePeriodLength ?? 5;
  const ovulationDay = Math.max(periodLen + 1, ringN - 14);
  const fertileStartDay = Math.max(periodLen + 1, ovulationDay - 5);
  const fertileEndDay = Math.min(ringN, ovulationDay + 1);

  return (
    <Screen>
      <ScreenHeader title="Résumé de mon cycle" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Anneau */}
        <Card style={styles.ringCard}>
          <CycleRing
            cycleLength={ringN}
            currentDay={prediction?.currentDay ?? null}
            periodLength={periodLen}
            fertileStartDay={fertileStartDay}
            fertileEndDay={fertileEndDay}
            ovulationDay={ovulationDay}
          />
        </Card>

        {/* Statistiques */}
        <Card style={styles.statsCard}>
          {cycleLengths.length >= 1 ? (
            <StatRow icon="sync-outline" label="Durée moyenne du cycle" value={`${ringN} jours`} />
          ) : null}
          {periodLengths.length >= 1 ? (
            <StatRow icon="water-outline" label="Durée moyenne des règles" value={`${periodLen} jours`} />
          ) : null}
          <StatRow icon="calendar-outline" label="Cycles enregistrés" value={`${cycles.length}`} />
          <StatRow icon="time-outline" label="Période couverte" value={`${formatDay(firstStart)} → ${formatDay(lastStart)}`} last />
        </Card>

        {/* Régularité */}
        {canAssessRegularity ? (
          <Card style={styles.regCard}>
            <View style={styles.regHead}>
              <View style={[styles.regIcon, { backgroundColor: isRegular ? colors.primaryLight : "#FFF3E0" }]}>
                <Ionicons name={isRegular ? "checkmark-circle" : "pulse"} size={22} color={isRegular ? colors.primaryDark : colors.accent} />
              </View>
              <View style={styles.regInfo}>
                <Text style={styles.regTitle}>Régularité</Text>
                <Text style={[styles.regBadge, isRegular ? styles.regBadgeOk : styles.regBadgeWarn]}>
                  {isRegular ? "Régulier" : "Irrégulier"}
                </Text>
              </View>
            </View>
            <Text style={styles.regExplain}>
              {isRegular
                ? `Vos cycles varient peu (±${Math.round(std)} j) : ils sont assez prévisibles.`
                : `Vos cycles varient sensiblement (±${Math.round(std)} j) : les prévisions restent indicatives.`}
            </Text>
          </Card>
        ) : null}

        {/* Symptômes fréquents */}
        {topSymptoms.length > 0 ? (
          <Card style={styles.symCard}>
            <Text style={styles.sectionTitle}>Symptômes les plus fréquents</Text>
            {topSymptoms.map(([name, n]) => (
              <View key={name} style={styles.symRow}>
                <View style={styles.symDot} />
                <Text style={styles.symName}>{name}</Text>
                <Text style={styles.symCount}>{n}×</Text>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function StatRow({ icon, label, value, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.statRow, !last && styles.statRowBorder]}>
      <View style={styles.statIcon}><Ionicons name={icon} size={18} color={colors.primary} /></View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  ringCard: { alignItems: "center", paddingVertical: spacing.lg },
  statsCard: { gap: 0 },
  statRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  statRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  statIcon: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  statLabel: { ...typography.body, flex: 1, color: colors.text },
  statValue: { ...typography.name, color: colors.primaryDark },
  regCard: { gap: spacing.sm },
  regHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  regIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  regInfo: { flex: 1, gap: 2 },
  regTitle: { ...typography.name },
  regBadge: { ...typography.caption, fontWeight: "700", alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden", color: colors.white },
  regBadgeOk: { backgroundColor: colors.success },
  regBadgeWarn: { backgroundColor: colors.accent },
  regExplain: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  symCard: { gap: spacing.xs },
  sectionTitle: { ...typography.h3, marginBottom: spacing.xs },
  symRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  symDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  symName: { ...typography.body, flex: 1, color: colors.text },
  symCount: { ...typography.name, color: colors.primaryDark },
});
