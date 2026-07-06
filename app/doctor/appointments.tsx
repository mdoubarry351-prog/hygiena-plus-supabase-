import { useEffect, useState, useCallback } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { Loading } from "@/components/Loading";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/providers/ToastProvider";
import { FadeInView } from "@/components/FadeInView";
import { useMyDoctor } from "@/hooks/useMyDoctor";
import { doctorService, type AppointmentWithPatient } from "@/lib/doctor-service";
import { formatAppointmentDate, formatAppointmentTime } from "@/lib/appointments-service";
import { hapticLight } from "@/lib/haptics";
import type { AppointmentStatus } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

const STEP = 55; // pas de l'apparition échelonnée

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

export default function DoctorAppointments() {
  const { doctor, loading: loadingDoctor } = useMyDoctor();
  const confirm = useConfirm();
  const toast = useToast();
  const [appointments, setAppointments] = useState<AppointmentWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function changeStatus(id: string, status: AppointmentStatus) {
    setBusyId(id);
    // Mise à jour optimiste.
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    try {
      await doctorService.updateStatus(id, status);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mise à jour du statut échouée");
      await load(); // resynchronise
    } finally {
      setBusyId(null);
    }
  }

  async function confirmCancel(id: string) {
    if (await confirm({ title: "Annuler le rendez-vous ?", message: "Le patient verra son rendez-vous comme annulé.", confirmLabel: "Annuler le RDV", cancelLabel: "Retour", danger: true })) {
      changeStatus(id, "cancelled");
    }
  }

  if (loadingDoctor || (loading && appointments.length === 0)) return <Loading />;

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={typography.h2}>Rendez-vous</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {appointments.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="Aucun rendez-vous"
            message="Les demandes de rendez-vous de vos patients apparaîtront ici."
          />
        ) : (
          appointments.map((a, i) => (
            <FadeInView key={a.id} fill={false} delay={Math.min(i, 6) * STEP}>
            <Card style={styles.apptCard}>
              <View style={styles.apptHead}>
                <View style={styles.apptInfo}>
                  <Text style={styles.patientName}>{a.patient?.full_name?.trim() || "Patient"}</Text>
                  {a.patient?.phone ? (
                    <View style={styles.metaRow}>
                      <Ionicons name="call-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.meta}>{a.patient.phone}</Text>
                    </View>
                  ) : null}
                </View>
                <Badge label={STATUS_LABELS[a.status]} color={STATUS_COLORS[a.status]} />
              </View>

              <View style={styles.dateRow}>
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.dateText}>{formatAppointmentDate(a.appointment_date)}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.dateText}>{formatAppointmentTime(a.appointment_time)}</Text>
                </View>
              </View>

              {a.reason ? <Text style={styles.reason}>{a.reason}</Text> : null}

              <StatusActions
                status={a.status}
                busy={busyId === a.id}
                onConfirm={() => changeStatus(a.id, "confirmed")}
                onComplete={() => changeStatus(a.id, "completed")}
                onCancel={() => confirmCancel(a.id)}
              />
            </Card>
            </FadeInView>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

// Actions disponibles selon le statut courant.
function StatusActions({
  status, busy, onConfirm, onComplete, onCancel,
}: {
  status: AppointmentStatus;
  busy: boolean;
  onConfirm: () => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  if (status === "cancelled" || status === "completed") {
    return (
      <View style={styles.terminalRow}>
        <Ionicons
          name={status === "completed" ? "checkmark-circle" : "close-circle"}
          size={16}
          color={status === "completed" ? colors.success : colors.danger}
        />
        <Text style={styles.terminalText}>
          {status === "completed" ? "Consultation terminée" : "Rendez-vous annulé"}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.actions}>
      {status === "pending" && (
        <ActionBtn icon="checkmark" label="Confirmer" color={colors.secondary} onPress={onConfirm} disabled={busy} />
      )}
      {status === "confirmed" && (
        <ActionBtn icon="checkmark-done" label="Terminer" color={colors.success} onPress={onComplete} disabled={busy} />
      )}
      <ActionBtn icon="close" label="Annuler" color={colors.danger} variant="outline" onPress={onCancel} disabled={busy} />
    </View>
  );
}

function ActionBtn({
  icon, label, color, onPress, disabled, variant = "solid",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "solid" | "outline";
}) {
  const outline = variant === "outline";
  return (
    <Pressable
      onPress={() => { hapticLight(); onPress(); }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionBtn,
        outline ? { borderWidth: 1.5, borderColor: color } : { backgroundColor: color },
        disabled && styles.actionDisabled,
        pressed && !disabled && styles.actionPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={16} color={outline ? color : colors.white} />
      <Text style={[styles.actionLabel, { color: outline ? color : colors.white }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.lg },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  empty: { alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  muted: { color: colors.textMuted, textAlign: "center" },
  apptCard: { gap: spacing.sm },
  apptHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  apptInfo: { flex: 1, gap: 2 },
  patientName: { ...typography.name },
  badge: {
    ...typography.caption, color: colors.white, fontWeight: "700",
    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden",
  },
  dateRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted },
  dateText: { ...typography.caption, color: colors.textMuted, textTransform: "capitalize" },
  reason: { ...typography.body, color: colors.text },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs,
    height: 44, borderRadius: radius.md,
  },
  actionDisabled: { opacity: 0.5 },
  actionPressed: { opacity: 0.8 },
  actionLabel: { fontSize: 14, fontWeight: "700" },
  terminalRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  terminalText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
});
