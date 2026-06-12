import { useEffect, useState, useCallback } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Loading } from "@/components/Loading";
import { RescheduleModal } from "@/components/RescheduleModal";
import { useAuth } from "@/providers/AuthProvider";
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
  const [appointments, setAppointments] = useState<AppointmentWithDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rescheduling, setRescheduling] = useState<AppointmentWithDoctor | null>(null);

  const load = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    try {
      const data = await appointmentsService.getAppointments(session.user.id);
      setAppointments(data);
    } catch {
      setAppointments([]);
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

  function cancelAppt(a: AppointmentWithDoctor) {
    Alert.alert("Annuler ce rendez-vous ?", "Cette action est définitive.", [
      { text: "Non", style: "cancel" },
      {
        text: "Annuler le RDV",
        style: "destructive",
        onPress: async () => {
          try {
            await appointmentsService.cancelAppointment(a.id);
            await load();
          } catch (e) {
            Alert.alert("Erreur", e instanceof Error ? e.message : "Annulation échouée");
          }
        },
      },
    ]);
  }

  // Un médecin n'a pas de RDV patient ici (il les reçoit via l'espace pro).
  if (role === "doctor") return <Redirect href="/(user)" />;

  if (loading && appointments.length === 0) return <Loading />;

  return (
    <Screen>
      <ScreenHeader title="Mes rendez-vous" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >

        {appointments.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="Aucun rendez-vous"
            message="Vos rendez-vous avec un médecin apparaîtront ici."
          />
        ) : (
          appointments.map((a) => {
            const name = doctorDisplayName(a.doctor?.profile ?? null);
            return (
              <Card key={a.id} style={styles.apptCard}>
                <View style={styles.apptHead}>
                  <View style={styles.apptInfo}>
                    <Text style={styles.name}>{name}</Text>
                    {a.doctor?.specialty ? (
                      <Text style={styles.specialty}>{a.doctor.specialty}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.badge, { backgroundColor: STATUS_COLORS[a.status] }]}>
                    {STATUS_LABELS[a.status]}
                  </Text>
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
                    onPress={() => router.push({ pathname: "/(user)/appointments/receipt", params: { id: a.id } })}
                    style={styles.receiptBtn}
                  >
                    <Ionicons name="receipt-outline" size={16} color={colors.primary} />
                    <Text style={styles.receiptBtnText}>Voir le reçu</Text>
                  </Pressable>
                ) : null}

                {isEligible(a) ? (
                  <View style={styles.actions}>
                    <Pressable onPress={() => setRescheduling(a)} style={[styles.actionBtn, styles.actionReschedule]}>
                      <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                      <Text style={[styles.actionText, { color: colors.primary }]}>Reporter</Text>
                    </Pressable>
                    <Pressable onPress={() => cancelAppt(a)} style={[styles.actionBtn, styles.actionCancel]}>
                      <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                      <Text style={[styles.actionText, { color: colors.danger }]}>Annuler le rendez-vous</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Card>
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
  actionReschedule: { borderColor: colors.primary },
  actionCancel: { borderColor: colors.danger },
  actionText: { ...typography.caption, fontWeight: "700" },
});
