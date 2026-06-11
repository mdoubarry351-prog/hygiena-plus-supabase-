import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Loading } from "@/components/Loading";
import { useAuth } from "@/providers/AuthProvider";
import { useAppSettings, showServiceUnavailable } from "@/hooks/useAppSettings";
import {
  appointmentsService,
  doctorDisplayName,
  formatAppointmentDate,
  generateReceiptNumber,
  type DoctorWithProfile,
} from "@/lib/appointments-service";
import { formatPrice } from "@/lib/marketplace-service";
import { colors, fonts, radius, spacing, typography } from "@/theme";

// Créneaux horaires proposés (toutes les 30 min, matin et après-midi).
const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
];

// Construit les 14 prochains jours sélectionnables, à partir de demain.
type DayOption = { date: string; weekday: string; day: string; month: string };

function buildDays(): DayOption[] {
  const days: DayOption[] = [];
  const today = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({
      date: iso,
      weekday: d.toLocaleDateString("fr-FR", { weekday: "short" }),
      day: String(d.getDate()),
      month: d.toLocaleDateString("fr-FR", { month: "short" }),
    });
  }
  return days;
}

export default function BookAppointment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session, profile, role } = useAuth();
  const { appointments_enabled, premium_enabled } = useAppSettings();

  const [doctor, setDoctor] = useState<DoctorWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const days = useMemo(buildDays, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const d = await appointmentsService.getDoctor(id);
        if (mounted) setDoctor(d);
      } catch (e) {
        Alert.alert("Erreur", e instanceof Error ? e.message : "Médecin introuvable", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  // Un médecin ne prend pas de RDV en tant que patient.
  if (role === "doctor") return <Redirect href="/(user)" />;

  if (loading) return <Loading />;
  if (!doctor) return null;

  const name = doctorDisplayName(doctor.profile);
  const canBook = !!selectedDate && !!selectedTime;

  async function handleBook() {
    if (!appointments_enabled) return showServiceUnavailable();
    if (!session?.user || !doctor || !selectedDate || !selectedTime) return;
    setSaving(true);
    try {
      await appointmentsService.createAppointment({
        patientId: session.user.id,
        doctorId: doctor.id,
        date: selectedDate,
        time: selectedTime,
        reason: reason.trim() || null,
      });
      Alert.alert(
        "Rendez-vous demandé",
        `Votre demande avec ${name} le ${formatAppointmentDate(selectedDate)} à ${selectedTime} a été envoyée. Vous serez notifiée dès sa confirmation.`,
        [{ text: "OK", onPress: () => router.replace("/(user)/appointments/mine") }]
      );
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Prise de rendez-vous échouée");
    } finally {
      setSaving(false);
    }
  }

  // Messagerie premium : conseils en ligne (≠ consultation, qui passe par un RDV).
  function handleMessage() {
    if (!premium_enabled) return showServiceUnavailable();
    if (!doctor) return;
    if (profile?.is_premium) {
      router.push({ pathname: "/(user)/appointments/chat", params: { doctorId: doctor.id, doctorName: name } });
    } else {
      router.push("/(user)/premium");
    }
  }

  // Paiement SIMULÉ : crée le RDV payé + reçu, puis ouvre le reçu.
  async function handlePay() {
    if (!appointments_enabled) return showServiceUnavailable();
    if (!session?.user || !doctor || !selectedDate || !selectedTime) return;
    setSaving(true);
    try {
      const created = await appointmentsService.createAppointment({
        patientId: session.user.id,
        doctorId: doctor.id,
        date: selectedDate,
        time: selectedTime,
        reason: reason.trim() || null,
        payment: { amountPaid: doctor.consultation_fee ?? 0, receiptNumber: generateReceiptNumber() },
      });
      router.replace({ pathname: "/(user)/appointments/receipt", params: { id: created.id } });
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Paiement échoué");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Prendre rendez-vous" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Card style={styles.doctorCard}>
          {doctor.profile?.avatar_url ? (
            <Image source={{ uri: doctor.profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="medkit-outline" size={28} color={colors.primary} />
            </View>
          )}
          <View style={styles.doctorInfo}>
            <Text style={typography.h3}>{name}</Text>
            <Text style={styles.specialty}>{doctor.specialty}</Text>
            {doctor.consultation_fee != null ? (
              <Text style={styles.fee}>{formatPrice(doctor.consultation_fee)}</Text>
            ) : null}
          </View>
        </Card>

        {doctor.bio ? (
          <Card style={styles.bioCard}>
            <Text style={typography.h3}>À propos</Text>
            <Text style={[typography.body, styles.muted]}>{doctor.bio}</Text>
          </Card>
        ) : null}

        <Pressable onPress={handleMessage} style={styles.msgBtn}>
          <Ionicons name="chatbubbles-outline" size={18} color={colors.primary} />
          <Text style={styles.msgBtnText}>Écrire au médecin (conseils)</Text>
          {!profile?.is_premium ? <Ionicons name="star" size={14} color={colors.accent} /> : null}
        </Pressable>
        <Text style={styles.msgNote}>
          Conseils en ligne (Premium). Pour une consultation, prenez rendez-vous ci-dessous.
        </Text>

        <Text style={[typography.h3, styles.sectionTitle]}>Choisir une date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
          {days.map((d) => {
            const active = selectedDate === d.date;
            return (
              <Pressable key={d.date} onPress={() => setSelectedDate(d.date)} style={[styles.dayChip, active && styles.chipActive]}>
                <Text style={[styles.dayWeekday, active && styles.chipTextActive]}>{d.weekday}</Text>
                <Text style={[styles.dayNumber, active && styles.chipTextActive]}>{d.day}</Text>
                <Text style={[styles.dayMonth, active && styles.chipTextActive]}>{d.month}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={[typography.h3, styles.sectionTitle]}>Choisir une heure</Text>
        <View style={styles.timeGrid}>
          {TIME_SLOTS.map((t) => {
            const active = selectedTime === t;
            return (
              <Pressable key={t} onPress={() => setSelectedTime(t)} style={[styles.timeChip, active && styles.chipActive]}>
                <Text style={[styles.timeText, active && styles.chipTextActive]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>

        <Input
          label="Motif (facultatif)"
          value={reason}
          onChangeText={setReason}
          placeholder="Ex. : consultation de suivi, douleurs…"
          multiline
          numberOfLines={3}
          style={styles.textArea}
        />

        {canBook ? (
          <Card style={styles.payCard}>
            <View style={styles.payRow}>
              <Text style={styles.payLabel}>Montant à payer</Text>
              <Text style={styles.payAmount}>
                {doctor.consultation_fee != null ? formatPrice(doctor.consultation_fee) : "Tarif sur place"}
              </Text>
            </View>
            <Text style={styles.paySummary}>{formatAppointmentDate(selectedDate!)} à {selectedTime}</Text>
            <Text style={styles.payNote}>Paiement simulé — aucun débit réel.</Text>
          </Card>
        ) : (
          <Text style={[styles.summary, styles.muted]}>Sélectionnez une date et une heure.</Text>
        )}

        {doctor.consultation_fee != null ? (
          <Button
            title={canBook ? `Payer ${formatPrice(doctor.consultation_fee)}` : "Payer"}
            onPress={handlePay}
            loading={saving}
            disabled={!canBook}
          />
        ) : (
          <Button title="Confirmer le rendez-vous" onPress={handleBook} loading={saving} disabled={!canBook} />
        )}
        <Button title="Annuler" variant="outline" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

const AVATAR = 64;
const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  doctorCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: radius.pill, backgroundColor: colors.primaryLight },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  doctorInfo: { flex: 1, gap: 2 },
  specialty: { ...typography.caption, color: colors.secondary, fontWeight: "600" },
  fee: { ...typography.body, fontWeight: "700", color: colors.primary, marginTop: spacing.xs },
  bioCard: { gap: spacing.sm },
  muted: { color: colors.textMuted },
  sectionTitle: { marginTop: spacing.sm },
  dayRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  dayChip: {
    width: 64, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: "center", gap: 2,
  },
  dayWeekday: { ...typography.caption, color: colors.textMuted, textTransform: "capitalize" },
  dayNumber: { ...typography.h3 },
  dayMonth: { ...typography.caption, color: colors.textMuted, textTransform: "capitalize" },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  timeChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
  timeText: { ...typography.body, fontWeight: "600" },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipTextActive: { color: colors.white },
  textArea: { height: 90, textAlignVertical: "top", paddingTop: spacing.sm },
  summary: { ...typography.body, fontWeight: "600", textTransform: "capitalize", textAlign: "center" },
  payCard: { backgroundColor: colors.primaryLight, borderColor: colors.primary, gap: spacing.xs },
  payRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  payLabel: { ...typography.body, color: colors.primaryDark },
  payAmount: { ...typography.h3, color: colors.primaryDark },
  paySummary: { ...typography.caption, color: colors.primaryDark, textTransform: "capitalize" },
  payNote: { ...typography.caption, color: colors.textMuted },
  msgBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, height: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary },
  msgBtnText: { ...typography.body, color: colors.primary, fontFamily: fonts.bodySemiBold },
  msgNote: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
});
