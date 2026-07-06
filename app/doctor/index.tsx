import { useEffect, useState, useCallback } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Loading } from "@/components/Loading";
import { FadeInView } from "@/components/FadeInView";
import { hapticLight } from "@/lib/haptics";
import { useAuth } from "@/providers/AuthProvider";
import { useMyDoctor } from "@/hooks/useMyDoctor";
import {
  doctorService,
  computeStats,
  todayISO,
  type AppointmentWithPatient,
} from "@/lib/doctor-service";
import { formatAppointmentTime } from "@/lib/appointments-service";
import { colors, radius, spacing, typography } from "@/theme";

export default function DoctorDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const { doctor, loading: loadingDoctor } = useMyDoctor();
  const [appointments, setAppointments] = useState<AppointmentWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!doctor) return;
    setLoading(true);
    try {
      setAppointments(await doctorService.getMyAppointments(doctor.id));
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [doctor]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loadingDoctor || (loading && appointments.length === 0)) return <Loading />;

  if (!doctor) {
    return (
      <Screen>
        <Pressable onPress={() => router.replace("/(user)")} style={styles.switchBar} hitSlop={6} accessibilityRole="button" accessibilityLabel="Revenir à mon espace perso">
          <Ionicons name="arrow-back" size={16} color={colors.primary} />
          <Text style={styles.switchText}>Mon espace perso</Text>
        </Pressable>
        <View style={styles.topBar}><Text style={typography.h2}>Tableau de bord</Text></View>
        <EmptyState
          icon="alert-circle-outline"
          title="Fiche médecin introuvable"
          message="Votre compte a le rôle médecin mais aucune fiche n'est rattachée. Contactez l'administrateur."
        />
      </Screen>
    );
  }

  const today = todayISO();
  const stats = computeStats(appointments, today);
  const todays = appointments
    .filter((a) => a.appointment_date === today && a.status !== "cancelled")
    .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));

  return (
    <Screen>
      <Pressable onPress={() => { hapticLight(); router.replace("/(user)"); }} style={({ pressed }) => [styles.switchBar, pressed && styles.switchPressed]} hitSlop={6} accessibilityRole="button" accessibilityLabel="Revenir à mon espace perso">
        <Ionicons name="arrow-back" size={16} color={colors.primary} />
        <Text style={styles.switchText}>Mon espace perso</Text>
      </Pressable>
      <View style={styles.topBar}>
        <Text style={styles.greeting} numberOfLines={1}>
          Dr {profile?.full_name?.split(" ").slice(-1)[0] ?? ""}
        </Text>
        <View style={styles.specialtyPill}>
          <Ionicons name="medkit-outline" size={14} color={colors.secondary} />
          <Text style={styles.specialtyText}>{doctor.specialty}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <FadeInView fill={false} delay={0}>
          <View style={styles.statsGrid}>
            <StatCard icon="calendar" label="À venir" value={stats.upcoming} tint={colors.primary} />
            <StatCard icon="today" label="Aujourd'hui" value={stats.today} tint={colors.secondary} />
            <StatCard icon="hourglass-outline" label="En attente" value={stats.pending} tint={colors.accent} />
            <StatCard icon="checkmark-done" label="Terminés" value={stats.completed} tint={colors.success} />
          </View>
        </FadeInView>

        <FadeInView fill={false} delay={STEP} style={styles.todayBlock}>
          <Text style={[typography.h3, styles.sectionTitle]}>Rendez-vous du jour</Text>
          {todays.length === 0 ? (
            <EmptyState icon="cafe-outline" title="Aucun rendez-vous aujourd'hui" />
          ) : (
            todays.map((a) => (
              <Card key={a.id} style={styles.todayRow}>
                <View style={styles.timePill}>
                  <Text style={styles.timeText}>{formatAppointmentTime(a.appointment_time)}</Text>
                </View>
                <View style={styles.todayInfo}>
                  <Text style={styles.patientName} numberOfLines={1}>
                    {a.patient?.full_name?.trim() || "Patient"}
                  </Text>
                  {a.reason ? <Text style={styles.reason} numberOfLines={1}>{a.reason}</Text> : null}
                </View>
                <Text style={[styles.miniBadge, a.status === "confirmed" ? styles.badgeConfirmed : styles.badgePending]}>
                  {a.status === "confirmed" ? "Confirmé" : "En attente"}
                </Text>
              </Card>
            ))
          )}
        </FadeInView>
      </ScrollView>
    </Screen>
  );
}

function StatCard({ icon, label, value, tint }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number; tint: string }) {
  return (
    <Card style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: tint + "22" }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

const STEP = 55; // pas de l'apparition échelonnée
const styles = StyleSheet.create({
  switchBar: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingTop: spacing.lg },
  switchPressed: { opacity: 0.5 },
  todayBlock: { gap: spacing.md },
  switchText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm, gap: spacing.sm },
  greeting: { ...typography.h2, flex: 1 },
  specialtyPill: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill,
  },
  specialtyText: { ...typography.caption, color: colors.secondary, fontWeight: "600" },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: { width: "47.5%", gap: spacing.xs, alignItems: "flex-start" },
  statIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 26, fontWeight: "700", color: colors.text },
  statLabel: { ...typography.caption, color: colors.textMuted },
  sectionTitle: { marginTop: spacing.sm },
  empty: { alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  emptyToday: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  muted: { color: colors.textMuted, textAlign: "center" },
  todayRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  timePill: {
    backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md,
  },
  timeText: { ...typography.body, fontWeight: "700", color: colors.primaryDark },
  todayInfo: { flex: 1, gap: 2 },
  patientName: { ...typography.name },
  reason: { ...typography.caption, color: colors.textMuted },
  miniBadge: {
    ...typography.caption, color: colors.white, fontWeight: "700",
    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden",
  },
  badgePending: { backgroundColor: colors.accent },
  badgeConfirmed: { backgroundColor: colors.secondary },
});
