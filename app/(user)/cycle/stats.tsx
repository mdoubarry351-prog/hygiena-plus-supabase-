import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Loading } from "@/components/Loading";
import { EmptyState } from "@/components/EmptyState";
import { OfflineBanner } from "@/components/OfflineBanner";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { FadeInView } from "@/components/FadeInView";
import { BarChart, HBarChart } from "@/components/BarChart";
import { useCycles } from "@/hooks/useCycles";
import type { MenstrualCycle } from "@/lib/database.types";
import { colors, spacing, typography } from "@/theme";

const MAX_BARS = 8; // derniers cycles affichés dans les histogrammes
const STEP = 55; // pas de l'apparition échelonnée (cohérent Vague 1)

function startTime(c: MenstrualCycle): number {
  return new Date(c.period_start).getTime();
}
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
// Libellé court d'un cycle (« 8/6 ») pour l'axe des abscisses.
function shortLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
function mean(arr: number[]): number {
  return arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0;
}

export default function CycleStats() {
  const { cycles, prediction, loading, offline, cachedAt } = useCycles();

  const data = useMemo(() => {
    const asc = [...cycles].sort((a, b) => startTime(a) - startTime(b));

    // 1) Durée du cycle = écart jusqu'au cycle suivant (bornes 5–90 j).
    const cycleSeries: { value: number; label: string }[] = [];
    for (let i = 0; i < asc.length - 1; i++) {
      const len = daysBetween(asc[i].period_start, asc[i + 1].period_start);
      if (len >= 5 && len <= 90) cycleSeries.push({ value: len, label: shortLabel(asc[i].period_start) });
    }

    // 2) Durée des règles (si period_end renseigné, bornes 1–14 j).
    const periodSeries: { value: number; label: string }[] = [];
    for (const c of asc) {
      if (c.period_end) {
        const len = daysBetween(c.period_start, c.period_end) + 1;
        if (len > 0 && len < 15) periodSeries.push({ value: len, label: shortLabel(c.period_start) });
      }
    }

    // 3) Symptômes les plus fréquents (top 6).
    const symCounts = new Map<string, number>();
    for (const c of cycles) for (const s of c.symptoms ?? []) symCounts.set(s, (symCounts.get(s) ?? 0) + 1);
    const topSymptoms = [...symCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));

    // 4) Répartition de l'humeur.
    const moodCounts = new Map<string, number>();
    for (const c of cycles) if (c.mood) moodCounts.set(c.mood, (moodCounts.get(c.mood) ?? 0) + 1);
    const moods = [...moodCounts.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

    // 5) Douleur par cycle renseigné + moyenne.
    const painSeries: { value: number; label: string }[] = [];
    for (const c of asc) if (c.pain != null) painSeries.push({ value: c.pain, label: shortLabel(c.period_start) });

    return {
      cycleSeries: cycleSeries.slice(-MAX_BARS),
      periodSeries: periodSeries.slice(-MAX_BARS),
      topSymptoms,
      moods,
      painSeries: painSeries.slice(-MAX_BARS),
      painAvg: painSeries.length ? mean(painSeries.map((p) => p.value)) : null,
    };
  }, [cycles, prediction]);

  if (loading && cycles.length === 0) return <Loading />;

  // Pas assez de données → message bienveillant.
  if (cycles.length < 2) {
    return (
      <Screen>
        <ScreenHeader title="Statistiques" />
        <EmptyState
          icon="bar-chart-outline"
          title="Bientôt tes statistiques"
          message="Enregistre quelques cycles pour visualiser tes tendances (durées, symptômes, humeur, douleur)."
        />
      </Screen>
    );
  }

  const avgCycle = prediction?.averageCycleLength ?? null;
  const avgPeriod = prediction?.averagePeriodLength ?? null;
  const hasAny =
    data.cycleSeries.length >= 2 ||
    data.periodSeries.length >= 2 ||
    data.topSymptoms.length > 0 ||
    data.moods.length > 0 ||
    data.painSeries.length > 0;

  return (
    <Screen>
      <View style={styles.fill}>
        <ScreenHeader title="Statistiques" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {offline ? <OfflineBanner cachedAt={cachedAt} /> : null}

          {!hasAny ? (
            <FadeInView fill={false} delay={0}>
              <EmptyState
                icon="bar-chart-outline"
                title="Pas encore assez de données"
                message="Ajoute des durées, symptômes, humeurs ou douleurs pour voir tes graphiques."
              />
            </FadeInView>
          ) : null}

          {/* 1) Durée du cycle */}
          {data.cycleSeries.length >= 2 ? (
            <FadeInView fill={false} delay={0}>
              <ChartCard icon="sync-outline" title="Durée du cycle" subtitle="En jours, sur les derniers cycles">
                <BarChart
                  labels={data.cycleSeries.map((d) => d.label)}
                  values={data.cycleSeries.map((d) => d.value)}
                  tint={colors.primary}
                  average={avgCycle}
                  unitSuffix=" j"
                  height={170}
                />
              </ChartCard>
            </FadeInView>
          ) : null}

          {/* 2) Durée des règles */}
          {data.periodSeries.length >= 2 ? (
            <FadeInView fill={false} delay={STEP}>
              <ChartCard icon="water-outline" title="Durée des règles" subtitle="En jours, sur les derniers cycles">
                <BarChart
                  labels={data.periodSeries.map((d) => d.label)}
                  values={data.periodSeries.map((d) => d.value)}
                  tint={colors.primaryDark}
                  average={avgPeriod}
                  unitSuffix=" j"
                  height={150}
                />
              </ChartCard>
            </FadeInView>
          ) : null}

          {/* 3) Symptômes fréquents */}
          {data.topSymptoms.length > 0 ? (
            <FadeInView fill={false} delay={STEP * 2}>
              <ChartCard icon="medkit-outline" title="Symptômes les plus fréquents" subtitle="Nombre d'occurrences">
                <HBarChart items={data.topSymptoms} tint={colors.primary} />
              </ChartCard>
            </FadeInView>
          ) : null}

          {/* 4) Répartition de l'humeur */}
          {data.moods.length > 0 ? (
            <FadeInView fill={false} delay={STEP * 3}>
              <ChartCard icon="happy-outline" title="Répartition de l'humeur" subtitle="Nombre de saisies par humeur">
                <HBarChart items={data.moods} tint={colors.accent} />
              </ChartCard>
            </FadeInView>
          ) : null}

          {/* 5) Douleur */}
          {data.painSeries.length > 0 ? (
            <FadeInView fill={false} delay={STEP * 4}>
              <ChartCard
                icon="pulse-outline"
                title="Douleur"
                subtitle={data.painAvg != null ? `Moyenne : ${data.painAvg.toFixed(1)}/10` : undefined}
              >
                {data.painSeries.length >= 2 ? (
                  <BarChart
                    labels={data.painSeries.map((d) => d.label)}
                    values={data.painSeries.map((d) => d.value)}
                    tint={colors.accent}
                    average={data.painAvg}
                    unitSuffix=""
                    height={150}
                  />
                ) : (
                  <View style={styles.singlePain}>
                    <Text style={styles.singlePainValue}>{data.painSeries[0].value}/10</Text>
                    <Text style={styles.singlePainHint}>Une seule saisie de douleur pour l'instant.</Text>
                  </View>
                )}
              </ChartCard>
            </FadeInView>
          ) : null}

          <FadeInView fill={false} delay={STEP * 5}>
            <MedicalDisclaimer text="Ces statistiques sont indicatives et ne constituent pas un avis médical." />
          </FadeInView>
        </ScrollView>
      </View>
    </Screen>
  );
}

function ChartCard({ icon, title, subtitle, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}><Ionicons name={icon} size={18} color={colors.primary} /></View>
        <View style={styles.cardTitles}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.cardSub}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { gap: spacing.md },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  cardIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  cardTitles: { flex: 1, gap: 2 },
  cardTitle: { ...typography.name },
  cardSub: { ...typography.caption, color: colors.textMuted },
  singlePain: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.md },
  singlePainValue: { ...typography.h1, color: colors.accent },
  singlePainHint: { ...typography.caption, color: colors.textMuted },
});
