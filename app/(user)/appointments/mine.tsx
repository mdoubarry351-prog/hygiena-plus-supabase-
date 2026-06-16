import { useEffect, useState, useCallback } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Loading } from "@/components/Loading";
import { RescheduleModal } from "@/components/RescheduleModal";
import { FadeInView } from "@/components/FadeInView";
import { useConfirm } from "@/components/ConfirmDialog";
import { useAuth } from "@/providers/AuthProvider";
import { hapticLight, hapticWarning } from "@/lib/haptics";
import { syncAppointmentReminders } from "@/lib/reminders";
import {
  appointmentsService,
  doctorDisplayName,
  formatAppointmentDate,
  formatAppointmentTime,
  type AppointmentWithDoctor,
} from "@/lib/appointments-service";
import type { AppointmentStatus } from "@/lib/database.types";
import { colors, fonts, radius, spacing, typography } from "@/theme";

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  cancelled: "Annulé",
  completed: "Terminé",
};

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending: colors.accent,
  confirmed: colors.secondary,
  cancelled: colors.danger,
  completed: colors.success,
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Actions autorisées : RDV actif (en attente/confirmé) et à venir (date ≥ aujourd'hui).
function isEligible(a: AppointmentWithDoctor): boolean {
  return (a.status === "pending" || a.status === "confirmed") && a.appointment_date >= todayISO();
}

export default function MyAppointments() {
  const { session, role } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();
  const [appointments, setAppointments] = useState<AppointmentWithDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rescheduling, setRescheduling] = useState<AppointmentWithDoctor | null>(null);

  const load = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    setError(false);
    try {
      const data = await appointmentsService.getAppointments(session.user.id);
      setAppointments(data);
      syncAppointmentReminders(data); // replanifie les rappels locaux (silencieux)
    } catch {
      // On garde les données déjà affichées (le cas échéant) et on signale l'erreur.
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function cancelAppt(a: AppointmentWithDoctor) {
    const ok = await confirm({
      title: "Annuler ce rendez-vous ?",
      message: "Cette action est définitive.",
      confirmLabel: "Annuler le RDV",
      cancelLabel: "Non",
      danger: true,
    });
    if (!ok) return;
    try {
      await appointmentsService.cancelAppointment(a.id);
      hapticWarning();
      await load();
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Annulation échouée");
    }
  }

  // Un médecin n'a pas de RDV patient ici (il les reçoit via l'espace pro).
  if (role === "doctor") return <Redirect href="/(user)" />;

  if (loading && appointments.length === 0) return <Loading />;

  // Échec réseau SANS aucune donnée : vrai état d'erreur (≠ « aucun rendez-vous »).
  if (error && appointments.length === 0) {
    return (
      <Screen>
        <ScreenHeader title="Mes rendez-vous" />
        <EmptyState
          icon="cloud-offline-outline"
          title="Connexion impossible"
          message="Vérifie ta connexion, puis réessaie."
          actionLabel="Réessayer"
          onAction={load}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Mes rendez-vous" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Données déjà chargées mais le rafraîchissement a échoué → hors-ligne. */}
        {error ? <OfflineBanner cachedAt={null} /> : null}

        {appointments.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="Aucun rendez-vous"
            message="Tes rendez-vous avec un médecin apparaîtront ici."
          />
        ) : (
          appointments.map((a, i) => {
            const name = doctorDisplayName(a.doctor?.profile ?? null);
            return (
              <FadeInView key={a.id} fill={false} delay={Math.min(i, 6) * 55}>
              <Card style={styles.apptCard}>
                <View style={styles.apptHead}>
                  <View style={styles.apptInfo}>
                    <Text style={styles.name}>{name}</Text>
                    {a.doctor?.specialty ? (
                      <Text style={styles.specialty}>{a.doctor.specialty}</Text>
                    ) : null}
                  </View>
                  <Badge label={STATUS_LABELS[a.status]} color={STATUS_COLORS[a.status]} />
                </View>
                <View style={styles.apptFoot}>
                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                    <Text style={styles.meta}>{formatAppointmentDate(a.appointment_date)}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                    <Text style={styles.meta}>{formatAppointmentTime(a.appointment_time)}</Text>
                  </View>
                </View>
                {a.reason ? <Text style={styles.reason}>{a.reason}</Text> : null}
                {a.is_paid ? (
                  <Pressable
                    onPress={() => { hapticLight(); router.push({ pathname: "/(user)/appointments/receipt", params: { id: a.id } }); }}
                    style={({ pressed }) => [styles.receiptBtn, pressed && styles.actionPressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Voir le reçu"
                  >
                    <Ionicons name="receipt-outline" size={16} color={colors.primary} />
                    <Text style={styles.receiptBtnText}>Voir le reçu</Text>
                  </Pressable>
                ) : null}

                {isEligible(a) ? (
                  <View style={styles.actions}>
                    <Pressable onPress={() => { hapticLight(); setRescheduling(a); }} style={({ pressed }) => [styles.actionBtn, styles.actionReschedule, pressed && styles.actionPressed]} accessibilityRole="button" accessibilityLabel="Reporter le rendez-vous">
                      <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                      <Text style={[styles.actionText, { color: colors.primary }]}>Reporter</Text>
                    </Pressable>
                    <Pressable onPress={() => { hapticLight(); cancelAppt(a); }} style={({ pressed }) => [styles.actionBtn, styles.actionCancel, pressed && styles.actionPressed]} accessibilityRole="button" accessibilityLabel="Annuler le rendez-vous">
                      <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                      <Text style={[styles.actionText, { color: colors.danger }]}>Annuler le rendez-vous</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Card>
              </FadeInView>
            );
          })
        )}
      </ScrollView>

      {rescheduling ? (
        <RescheduleModal
          appointmentId={rescheduling.id}
          doctorId={rescheduling.doctor_id}
          currentDate={rescheduling.appointment_date}
          currentTime={rescheduling.appointment_time}
          onClose={() => setRescheduling(null)}
          onDone={async () => { setRescheduling(null); await load(); }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  empty: { alignItems: "center", gap: spacing.sm },
  muted: { color: colors.textMuted, textAlign: "center" },
  receiptBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start", paddingTop: spacing.xs },
  receiptBtnText: { ...typography.caption, color: colors.primary, fontFamily: fonts.bodySemiBold },
  apptCard: { gap: spacing.sm },
  apptHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  apptInfo: { flex: 1, gap: 2 },
  name: { ...typography.name },
  specialty: { ...typography.caption, color: colors.secondary, fontWeight: "600" },
  badge: {
    ...typography.caption, color: colors.white, fontWeight: "700",
    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden",
  },
  apptFoot: {
    flexDirection: "row", alignItems: "center", gap: spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted, textTransform: "capitalize" },
  reason: { ...typography.body, color: colors.text },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5 },
  actionPressed: { opacity: 0.6 },
  actionReschedule: { borderColor: colors.primary },
  actionCancel: { borderColor: colors.danger },
  actionText: { ...typography.caption, fontWeight: "700" },
});
