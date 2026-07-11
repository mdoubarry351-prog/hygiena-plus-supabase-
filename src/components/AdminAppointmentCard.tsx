import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/Card";
import { Badge, type BadgeTone } from "@/components/Badge";
import { formatAppointmentDate, formatAppointmentTime, CONSULTATION_MODE_LABEL } from "@/lib/appointments-service";
import { formatPrice } from "@/lib/marketplace-service";
import type { AdminAppointmentRow } from "@/lib/admin-service";
import type { AppointmentStatus } from "@/lib/database.types";
import { colors, spacing, typography } from "@/theme";

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  cancelled: "Annulé",
  completed: "Terminé",
};
// Tons de chips « Le Cockpit » (soft) — cohérents avec les Commandes :
// en attente=ambre, confirmé=violet, annulé=rose, terminé=menthe.
const STATUS_TONE: Record<AppointmentStatus, BadgeTone> = {
  pending: "warning",
  confirmed: "primary",
  cancelled: "danger",
  completed: "success",
};

// Carte RDV pour les écrans admin (lecture seule, aucune donnée médicale) :
// patiente, médecin, date/heure, badges statut + mode, et montant si payé.
export function AdminAppointmentCard({ a }: { a: AdminAppointmentRow }) {
  const patient = a.patient_name?.trim() || "Patiente";
  const doctor = a.doctor_name?.trim() || "Médecin";
  const modeColor = a.consultation_mode === "remote" ? colors.secondary : colors.primary;
  return (
    <Card style={styles.row}>
      <View style={styles.head}>
        <View style={styles.names}>
          <Text style={styles.patient} numberOfLines={1}>{patient}</Text>
          <View style={styles.metaLine}>
            <Ionicons name="medkit-outline" size={13} color={colors.textMuted} />
            <Text style={styles.doctor} numberOfLines={1}>{doctor}{a.specialty ? ` · ${a.specialty}` : ""}</Text>
          </View>
        </View>
        <View style={styles.badges}>
          <Badge label={STATUS_LABELS[a.status]} tone={STATUS_TONE[a.status]} soft />
          {/* Mode = attribut secondaire → chip discrète, texte teinté sur fond neutre */}
          <Badge label={CONSULTATION_MODE_LABEL[a.consultation_mode]} tone="neutral" color={modeColor} soft />
        </View>
      </View>
      <View style={styles.foot}>
        <View style={styles.metaLine}>
          <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
          <Text style={styles.meta}>{formatAppointmentDate(a.appointment_date)}</Text>
        </View>
        <View style={styles.metaLine}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <Text style={styles.meta}>{formatAppointmentTime(a.appointment_time)}</Text>
        </View>
        {a.is_paid ? (
          <View style={styles.metaLine}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={styles.meta}>{a.amount_paid != null ? formatPrice(a.amount_paid) : "Payé"}</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  names: { flex: 1, gap: 2 },
  patient: { ...typography.name },
  doctor: { ...typography.caption, color: colors.textMuted, flex: 1 },
  badges: { alignItems: "flex-end", gap: 4 },
  metaLine: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  foot: { flexDirection: "row", alignItems: "center", gap: spacing.lg, flexWrap: "wrap", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  meta: { ...typography.caption, color: colors.textMuted, textTransform: "capitalize" },
});
