import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Loading } from "@/components/Loading";
import { useCycles } from "@/hooks/useCycles";
import { colors, fonts, phase, radius, spacing, typography } from "@/theme";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

type DayType = "period" | "ovulation" | "fertile" | "predicted" | null;

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function CalendarScreen() {
  const { cycles, prediction, loading } = useCycles();
  const [viewDate, setViewDate] = useState(new Date());

  // Construit l'ensemble des jours marqués
  const dayTypes = useMemo(() => {
    const map = new Map<string, DayType>();
    const key = (d: Date) => d.toISOString().split("T")[0];

    // Jours de règles réels
    for (const c of cycles) {
      const start = new Date(c.period_start);
      const end = c.period_end ? new Date(c.period_end) : start;
      const cur = new Date(start);
      while (cur <= end) {
        map.set(key(cur), "period");
        cur.setDate(cur.getDate() + 1);
      }
    }

    // Prédictions
    if (prediction?.hasEnoughData) {
      if (prediction.nextPeriodStart) {
        const s = new Date(prediction.nextPeriodStart);
        for (let i = 0; i < prediction.averagePeriodLength; i++) {
          const d = new Date(s); d.setDate(d.getDate() + i);
          if (!map.has(key(d))) map.set(key(d), "predicted");
        }
      }
      if (prediction.fertileWindowStart && prediction.fertileWindowEnd) {
        const cur = new Date(prediction.fertileWindowStart);
        const end = new Date(prediction.fertileWindowEnd);
        while (cur <= end) {
          if (!map.has(key(cur))) map.set(key(cur), "fertile");
          cur.setDate(cur.getDate() + 1);
        }
      }
      if (prediction.nextOvulation) {
        map.set(key(new Date(prediction.nextOvulation)), "ovulation");
      }
    }
    return map;
  }, [cycles, prediction]);

  const grid = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = new Date(year, month, 1);
    const startWeekday = (first.getDay() + 6) % 7; // Lundi = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [viewDate]);

  function changeMonth(delta: number) {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }

  if (loading && cycles.length === 0) return <Loading />;

  const today = new Date();

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={typography.h2}>Mon cycle</Text>

        <Card style={styles.calCard}>
          <View style={styles.header}>
            <Pressable onPress={() => changeMonth(-1)} hitSlop={12}><Text style={styles.nav}>‹</Text></Pressable>
            <Text style={styles.monthLabel}>{MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}</Text>
            <Pressable onPress={() => changeMonth(1)} hitSlop={12}><Text style={styles.nav}>›</Text></Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => <Text key={i} style={styles.weekday}>{w}</Text>)}
          </View>

          <View style={styles.grid}>
            {grid.map((d, i) => {
              if (!d) return <View key={i} style={styles.cell} />;
              const type = dayTypes.get(d.toISOString().split("T")[0]);
              const isToday = sameDay(d, today);
              return (
                <View key={i} style={styles.cell}>
                  <View style={[
                    styles.dayDot,
                    type === "period" && styles.dayPeriod,
                    type === "predicted" && styles.dayPredicted,
                    type === "fertile" && styles.dayFertile,
                    type === "ovulation" && styles.dayOvulation,
                    isToday && styles.dayToday,
                  ]}>
                    <Text style={[
                      styles.dayText,
                      (type === "period" || type === "ovulation") && styles.dayTextLight,
                      type === "predicted" && styles.dayTextPredicted,
                      type === "fertile" && styles.dayTextFertile,
                    ]}>{d.getDate()}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Légende */}
        <Card style={styles.legend}>
          <LegendItem color={phase.period} label="Règles" />
          <LegendItem color={phase.periodSoft} label="Règles prévues" borderColor={phase.period} />
          <LegendItem color={phase.fertileSoft} label="Fenêtre fertile" borderColor={phase.fertile} />
          <LegendItem color={phase.ovulation} label="Ovulation" />
        </Card>
      </ScrollView>
    </Screen>
  );
}

function LegendItem({ color, label, borderColor }: { color: string; label: string; borderColor?: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }, borderColor ? { borderWidth: 1.5, borderColor } : null]} />
      <Text style={typography.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  calCard: { gap: spacing.md },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nav: { fontSize: 28, color: colors.primary, fontWeight: "600", paddingHorizontal: spacing.md },
  monthLabel: { ...typography.h3 },
  weekRow: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", ...typography.caption, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayDot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  dayText: { ...typography.body },
  dayTextLight: { color: colors.white, fontWeight: "600", fontFamily: fonts.bodySemiBold },
  dayTextPredicted: { color: phase.period, fontWeight: "600", fontFamily: fonts.bodySemiBold },
  dayTextFertile: { color: colors.primaryDark, fontWeight: "600", fontFamily: fonts.bodySemiBold },
  dayPeriod: { backgroundColor: phase.period },
  dayPredicted: { backgroundColor: phase.periodSoft, borderWidth: 1.5, borderColor: phase.period },
  dayFertile: { backgroundColor: phase.fertileSoft },
  dayOvulation: { backgroundColor: phase.ovulation },
  dayToday: { borderWidth: 2, borderColor: colors.text },
  legend: { gap: spacing.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  legendDot: { width: 18, height: 18, borderRadius: 9 },
});
