import { useEffect, useRef, useState } from "react";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Loading } from "@/components/Loading";
import { Divider } from "@/components/Divider";
import { FadeInView } from "@/components/FadeInView";
import { AppointmentContact } from "@/components/AppointmentContact";
import { practitionerLabels } from "@/lib/practitioner";
import { useAuth } from "@/providers/AuthProvider";
import {
  appointmentsService,
  doctorDisplayName,
  formatAppointmentDate,
  formatAppointmentTime,
  type AppointmentReceipt,
} from "@/lib/appointments-service";
import { formatPrice } from "@/lib/marketplace-service";
import { colors, fonts, radius, spacing, typography } from "@/theme";

export default function Receipt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useAuth();
  const router = useRouter();
  const [appt, setAppt] = useState<AppointmentReceipt | null>(null);
  const [loading, setLoading] = useState(true);

  // « Pop » doux du sceau de paiement (spring scale) au premier rendu du reçu.
  const pop = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    if (loading || !appt) return;
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 12 }).start();
  }, [loading, appt, pop]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const a = await appointmentsService.getAppointmentReceipt(id);
        if (mounted) setAppt(a);
      } catch {
        if (mounted) setAppt(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (role === "doctor") return <Redirect href="/(user)" />;
  if (loading) return <Loading />;
  if (!appt) return null;

  const doctorName = doctorDisplayName(appt.doctor?.profile ?? null);
  const clinic = appt.doctor?.clinic_name?.trim() || "Clinique non renseignée";
  const mode = appt.consultation_mode;
  const L = practitionerLabels(appt.doctor?.practitioner_type);
  const modeLabel = L.modeLabel[mode];
  const modeColor = mode === "remote" ? colors.secondary : colors.primary;

  return (
    <Screen>
      <FadeInView>
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.badge}>
          <Animated.View style={[styles.badgeCircle, { transform: [{ scale: pop }] }]}>
            <Ionicons name="checkmark" size={36} color={colors.white} />
          </Animated.View>
          <Text style={styles.paid}>Payé</Text>
          <Text style={styles.paidSub}>Ton paiement a bien été pris en compte</Text>
          <Badge label={modeLabel} color={modeColor} />
        </View>

        <Card style={styles.ticket}>
          <Text style={styles.title}>Reçu de consultation</Text>
          <Text style={styles.receiptNo}>{appt.receipt_number ?? "—"}</Text>

          <Divider spacing={spacing.xs} />

          <Row label={L.nounCap} value={doctorName} />
          <Row label="Type" value={modeLabel} />
          {mode === "physical" ? <Row label="Clinique" value={clinic} /> : null}
          <Row label="Date" value={formatAppointmentDate(appt.appointment_date)} capitalize />
          <Row label="Heure" value={formatAppointmentTime(appt.appointment_time)} />

          <Divider spacing={spacing.xs} />

          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Montant payé</Text>
            <Text style={styles.amount}>
              {appt.amount_paid != null ? formatPrice(appt.amount_paid) : "—"}
            </Text>
          </View>
          {appt.paid_at ? (
            <Text style={styles.paidAt}>
              Réglé le {new Date(appt.paid_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </Text>
          ) : null}
        </Card>

        <AppointmentContact mode={mode} phone={appt.doctor?.profile?.phone} clinicName={appt.doctor?.clinic_name} noun={L.noun} />

        <Text style={styles.note}>Paiement simulé — démonstration, aucun débit réel.</Text>

        <Button title="Voir mes rendez-vous" onPress={() => router.replace("/(user)/appointments/mine")} />
      </ScrollView>
      </FadeInView>
    </Screen>
  );
}

function Row({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, capitalize && styles.cap]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  back: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -spacing.xs },
  backText: { ...typography.body, color: colors.text },
  badge: { alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
  badgeCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.primaryDark, shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  paid: { ...typography.h2, color: colors.primaryDark },
  paidSub: { ...typography.caption, color: colors.textMuted },
  ticket: { gap: spacing.sm },
  title: { ...typography.h3, textAlign: "center" },
  receiptNo: { ...typography.body, color: colors.primary, fontFamily: fonts.bodyBold, textAlign: "center", letterSpacing: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, paddingVertical: 2 },
  rowLabel: { ...typography.body, color: colors.textMuted },
  rowValue: { ...typography.name, flexShrink: 1, textAlign: "right" },
  cap: { textTransform: "capitalize" },
  amountRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  amountLabel: { ...typography.body, color: colors.text },
  amount: { ...typography.h2, color: colors.primaryDark },
  paidAt: { ...typography.caption, color: colors.textMuted, textAlign: "right" },
  note: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
});
