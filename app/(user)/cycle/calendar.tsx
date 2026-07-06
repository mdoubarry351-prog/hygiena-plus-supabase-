import { useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";
import { EmptyState } from "@/components/EmptyState";
import { FadeInView } from "@/components/FadeInView";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useCycles } from "@/hooks/useCycles";
import { useAppSettings } from "@/hooks/useAppSettings";
import {  } from "@/lib/app-config";
import { hapticLight } from "@/lib/haptics";
import { toISODate } from "@/lib/dates";
import type { MenstrualCycle } from "@/lib/database.types";
import { colors, durations, fonts, phase, radius, spacing, typography } from "@/theme";

// Pas de l'apparition échelonnée (cohérent Vague 1).
const STEP = 55;

// Cartes d'accès du module cycle.
const LINKS: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; href: Href }[] = [
  { icon: "stats-chart-outline", title: "Voir mon résumé", sub: "Durée moyenne, régularité, symptômes", href: "/(user)/cycle/summary" },
  { icon: "bar-chart-outline", title: "Statistiques", sub: "Graphiques : durées, symptômes, humeur, douleur", href: "/(user)/cycle/stats" },
  { icon: "list-outline", title: "Historique des cycles", sub: "Tous tes cycles, modifier ou supprimer", href: "/(user)/cycle/history" },
  { icon: "bulb-outline", title: "Comprendre mon cycle", sub: "Phases, ovulation, fertilité, irrégularités", href: "/(user)/cycle/learn" },
  // Suivi de grossesse retiré de l'accès tant que =false (réversible ;
];

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const SLIDE = 26; // amplitude du glissement horizontal entre deux mois

type DayType = "period" | "ovulation" | "fertile" | "predicted" | null;

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Clé jour en date LOCALE (même convention que la saisie du cycle — la clé
// UTC décalait d'un jour autour de minuit pour tout fuseau ≠ UTC).
function dayKey(d: Date): string {
  return toISODate(d);
}

// Un cycle « avec saisie » = au moins un champ de ressenti renseigné ce jour-là.
function hasEntry(c: MenstrualCycle): boolean {
  return (
    (!!c.symptoms && c.symptoms.length > 0) ||
    !!c.flow ||
    !!c.mood ||
    c.pain != null ||
    (!!c.notes && c.notes.trim().length > 0)
  );
}

function painDescriptor(p: number): string {
  if (p === 0) return "aucune";
  if (p <= 3) return "légère";
  if (p <= 6) return "modérée";
  if (p <= 9) return "forte";
  return "intense";
}

export default function CalendarScreen() {
  const { cycles, prediction, loading, offline, cachedAt } = useCycles();
  const { cycle_enabled } = useAppSettings();
  const [viewDate, setViewDate] = useState(new Date());
  const [selected, setSelected] = useState<MenstrualCycle | null>(null);
  const router = useRouter();

  // Animation de transition entre mois (fondu + slide), native driver.
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const animating = useRef(false);

  // Construit l'ensemble des jours marqués
  const dayTypes = useMemo(() => {
    const map = new Map<string, DayType>();

    // Jours de règles réels
    for (const c of cycles) {
      const start = new Date(c.period_start);
      const end = c.period_end ? new Date(c.period_end) : start;
      const cur = new Date(start);
      while (cur <= end) {
        map.set(dayKey(cur), "period");
        cur.setDate(cur.getDate() + 1);
      }
    }

    // Prédictions
    if (prediction?.hasEnoughData) {
      if (prediction.nextPeriodStart) {
        const s = new Date(prediction.nextPeriodStart);
        for (let i = 0; i < prediction.averagePeriodLength; i++) {
          const d = new Date(s); d.setDate(d.getDate() + i);
          if (!map.has(dayKey(d))) map.set(dayKey(d), "predicted");
        }
      }
      if (prediction.fertileWindowStart && prediction.fertileWindowEnd) {
        const cur = new Date(prediction.fertileWindowStart);
        const end = new Date(prediction.fertileWindowEnd);
        while (cur <= end) {
          if (!map.has(dayKey(cur))) map.set(dayKey(cur), "fertile");
          cur.setDate(cur.getDate() + 1);
        }
      }
      if (prediction.nextOvulation) {
        map.set(dayKey(new Date(prediction.nextOvulation)), "ovulation");
      }
    }
    return map;
  }, [cycles, prediction]);

  // Jours pour lesquels une saisie existe → pastille + aperçu au tap.
  // Clé = period_start (déjà AAAA-MM-JJ), normalisée comme dayKey pour matcher la grille.
  const entriesByDay = useMemo(() => {
    const map = new Map<string, MenstrualCycle>();
    for (const c of cycles) {
      if (hasEntry(c)) map.set(dayKey(new Date(c.period_start)), c);
    }
    return map;
  }, [cycles]);

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

  // Change de mois avec animation : sortie (fondu + slide dans le sens), bascule
  // de la date, puis entrée depuis le côté opposé.
  function changeMonth(delta: number) {
    if (animating.current) return;
    animating.current = true;
    hapticLight();
    const out = delta > 0 ? -SLIDE : SLIDE;
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: durations.fast, useNativeDriver: true }),
      Animated.timing(slide, { toValue: out, duration: durations.fast, useNativeDriver: true }),
    ]).start(() => {
      slide.setValue(-out);
      setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: durations.normal, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: durations.normal, useNativeDriver: true }),
      ]).start(() => { animating.current = false; });
    });
  }

  // Service désactivé par l'admin : état neutre (n'empêche pas les autres onglets).
  if (!cycle_enabled) {
    return (
      <Screen>
        <EmptyState
          icon="water-outline"
          title="Service non disponible pour le moment"
          message="Le suivi du cycle est temporairement désactivé."
        />
      </Screen>
    );
  }

  if (loading && cycles.length === 0) return <Loading />;

  const today = new Date();

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <FadeInView fill={false} delay={0}>
          <Text style={typography.h2}>Mon cycle</Text>
        </FadeInView>

        {offline ? <OfflineBanner cachedAt={cachedAt} /> : null}

        {LINKS.map((l, i) => (
          <FadeInView key={l.title} fill={false} delay={STEP * (i + 1)}>
            <Card onPress={() => router.push(l.href)} haptic accessibilityLabel={l.title} style={styles.summaryCard}>
              <View style={styles.summaryIcon}>
                <Ionicons name={l.icon} size={20} color={colors.primaryDark} />
              </View>
              <View style={styles.summaryText}>
                <Text style={styles.summaryTitle}>{l.title}</Text>
                <Text style={styles.summarySub}>{l.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Card>
          </FadeInView>
        ))}

        <FadeInView fill={false} delay={STEP * 6}>
        <Card style={styles.calCard}>
          <View style={styles.header}>
            <Pressable onPress={() => changeMonth(-1)} hitSlop={12}><Text style={styles.nav}>‹</Text></Pressable>
            <Animated.Text style={[styles.monthLabel, { opacity: fade }]}>{MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}</Animated.Text>
            <Pressable onPress={() => changeMonth(1)} hitSlop={12}><Text style={styles.nav}>›</Text></Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => <Text key={i} style={styles.weekday}>{w}</Text>)}
          </View>

          <Animated.View style={[styles.grid, { opacity: fade, transform: [{ translateX: slide }] }]}>
            {grid.map((d, i) => {
              if (!d) return <View key={i} style={styles.cell} />;
              const k = dayKey(d);
              const type = dayTypes.get(k);
              const entry = entriesByDay.get(k);
              const isToday = sameDay(d, today);
              const dot = (
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
              );
              if (entry) {
                return (
                  <Pressable
                    key={i}
                    style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
                    onPress={() => { hapticLight(); setSelected(entry); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Voir la saisie du ${d.getDate()}`}
                  >
                    {dot}
                    <View style={styles.entryMark} />
                  </Pressable>
                );
              }
              return <View key={i} style={styles.cell}>{dot}</View>;
            })}
          </Animated.View>
        </Card>
        </FadeInView>

        {/* Légende */}
        <FadeInView fill={false} delay={STEP * 7}>
          <Card style={styles.legend}>
            <LegendItem color={phase.period} label="Règles" />
            <LegendItem color={phase.periodSoft} label="Règles prévues" borderColor={phase.period} />
            <LegendItem color={phase.fertileSoft} label="Fenêtre fertile" borderColor={phase.fertile} />
            <LegendItem color={phase.ovulation} label="Ovulation" />
            <LegendItem color={colors.accent} label="Saisie / symptômes" small />
          </Card>
        </FadeInView>
      </ScrollView>

      {/* Aperçu (lecture seule) de la saisie d'un jour. */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetBar}>
              <Text style={styles.sheetTitle}>
                {selected ? new Date(`${selected.period_start}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""}
              </Text>
              <Pressable onPress={() => setSelected(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer">
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            {selected ? (
              <>
                <View style={styles.sheetBody}>
                  {selected.flow ? <DetailRow icon="water-outline" label="Flux" value={selected.flow} /> : null}
                  {selected.mood ? <DetailRow icon="happy-outline" label="Humeur" value={selected.mood} /> : null}
                  {selected.pain != null ? <DetailRow icon="pulse-outline" label="Douleur" value={`${selected.pain}/10 · ${painDescriptor(selected.pain)}`} /> : null}
                  {selected.symptoms && selected.symptoms.length > 0 ? (
                    <DetailRow icon="medkit-outline" label="Symptômes" value={selected.symptoms.join(", ")} />
                  ) : null}
                  {selected.notes ? <DetailRow icon="document-text-outline" label="Notes" value={selected.notes} /> : null}
                </View>
                <Button
                  title="Modifier"
                  variant="outline"
                  onPress={() => {
                    const id = selected.id;
                    setSelected(null);
                    router.push({ pathname: "/(user)/cycle/log", params: { id } });
                  }}
                />
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function LegendItem({ color, label, borderColor, small }: { color: string; label: string; borderColor?: string; small?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[small ? styles.legendDotSmall : styles.legendDot, { backgroundColor: color }, borderColor ? { borderWidth: 1.5, borderColor } : null]} />
      <Text style={typography.caption}>{label}</Text>
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}><Ionicons name={icon} size={18} color={colors.primary} /></View>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  summaryCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  summaryIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  summaryText: { flex: 1, gap: 2 },
  summaryTitle: { ...typography.name, color: colors.primaryDark },
  summarySub: { ...typography.caption, color: colors.textMuted },
  calCard: { gap: spacing.md },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nav: { fontSize: 28, color: colors.primary, fontWeight: "600", paddingHorizontal: spacing.md },
  monthLabel: { ...typography.h3 },
  weekRow: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", ...typography.caption, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  cellPressed: { opacity: 0.55, transform: [{ scale: 0.92 }] },
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
  entryMark: { position: "absolute", bottom: 3, width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.accent },
  legend: { gap: spacing.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  legendDot: { width: 18, height: 18, borderRadius: 9 },
  legendDotSmall: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 5 },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.md,
  },
  sheetBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { ...typography.h3, flex: 1, textTransform: "capitalize" },
  sheetBody: { gap: spacing.sm },
  detailRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  detailIcon: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  detailText: { flex: 1, gap: 2 },
  detailLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  detailValue: { ...typography.body, color: colors.text },
});
