import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Loading } from "@/components/Loading";
import { StarRating } from "@/components/StarRating";
import { ReviewsSection } from "@/components/ReviewsSection";
import { useAuth } from "@/providers/AuthProvider";
import { useAppSettings, showServiceUnavailable } from "@/hooks/useAppSettings";
import {
  appointmentsService,
  doctorDisplayName,
  formatAppointmentDate,
  generateReceiptNumber,
  dayKeyForDate,
  dayAvailability,
  hasAnyAvailability,
  generateSlots,
  type DoctorWithProfile,
} from "@/lib/appointments-service";
import { formatPrice } from "@/lib/marketplace-service";
import { colors, fonts, radius, spacing, typography } from "@/theme";

// Construit les 14 prochains jours (à partir d'aujourd'hui).
type DayOption = { date: string; weekday: string; day: string; month: string };

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildDays(): DayOption[] {
  const days: DayOption[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      date: toISO(d),
      weekday: d.toLocaleDateString("fr-FR", { weekday: "short" }),
      day: String(d.getDate()),
      month: d.toLocaleDateString("fr-FR", { month: "short" }),
    });
  }
  return days;
}

// Violation de l'index unique anti double-réservation (créneau pris entre-temps).
function isSlotConflict(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  const msg = e instanceof Error ? e.message : "";
  return code === "23505" || /duplicate key|unique constraint/i.test(msg);
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
  const todayISO = useMemo(() => toISO(new Date()), []);
  const [bookedSet, setBookedSet] = useState<Set<string>>(new Set());

  // Récupère les créneaux occupés du médecin sur la plage affichée.
  const refreshSlots = useCallback(async () => {
    if (days.length === 0) return;
    try {
      const slots = await appointmentsService.getBookedSlots(id, days[0].date, days[days.length - 1].date);
      setBookedSet(new Set(slots.map((s) => `${s.date}|${s.time}`)));
    } catch {
      setBookedSet(new Set());
    }
  }, [days, id]);

  useEffect(() => { refreshSlots(); }, [refreshSlots]);

  // Créneaux proposés pour la date choisie : disponibilité du jour − occupés − passés.
  const selectedSlots = useMemo(() => {
    if (!selectedDate || !doctor) return [];
    const avail = dayAvailability(doctor.availability, dayKeyForDate(selectedDate));
    if (!avail) return [];
    let slots = generateSlots(avail.start, avail.end).filter((t) => !bookedSet.has(`${selectedDate}|${t}`));
    if (selectedDate === todayISO) {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      slots = slots.filter((t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m > nowMin; });
    }
    return slots;
  }, [selectedDate, doctor, bookedSet, todayISO]);

  // Rafraîchit la note moyenne du médecin après un avis.
  async function reloadDoctor() {
    try {
      const d = await appointmentsService.getDoctor(id);
      setDoctor(d);
    } catch {
      // silencieux
    }
  }

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
  const availabilityDefined = hasAnyAvailability(doctor.availability);
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
      if (isSlotConflict(e)) {
        await refreshSlots();
        setSelectedTime(null);
        Alert.alert("Créneau indisponible", "Ce créneau vient d'être réservé, choisissez-en un autre.");
      } else {
        Alert.alert("Erreur", e instanceof Error ? e.message : "Prise de rendez-vous échouée");
      }
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
      if (isSlotConflict(e)) {
        await refreshSlots();
        setSelectedTime(null);
        Alert.alert("Créneau indisponible", "Ce créneau vient d'être réservé, choisissez-en un autre.");
      } else {
        Alert.alert("Erreur", e instanceof Error ? e.message : "Paiement échoué");
      }
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
            <StarRating value={doctor.rating_avg} count={doctor.rating_count} size={14} compact />
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

        {!availabilityDefined ? (
          <Card style={styles.noAvailCard}>
            <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
            <Text style={styles.noAvailText}>Ce médecin n'a pas encore défini ses disponibilités.</Text>
          </Card>
        ) : (
          <>
            <Text style={[typography.h3, styles.sectionTitle]}>Choisir une date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
              {days.map((d) => {
                const available = dayAvailability(doctor.availability, dayKeyForDate(d.date)) !== null;
                const active = selectedDate === d.date;
                return (
                  <Pressable
                    key={d.date}
                    disabled={!available}
                    onPress={() => { setSelectedDate(d.date); setSelectedTime(null); }}
                    style={[styles.dayChip, active && styles.chipActive, !available && styles.dayChipDisabled]}
                  >
                    <Text style={[styles.dayWeekday, active && styles.chipTextActive, !available && styles.dayTextDisabled]}>{d.weekday}</Text>
                    <Text style={[styles.dayNumber, active && styles.chipTextActive, !available && styles.dayTextDisabled]}>{d.day}</Text>
                    <Text style={[styles.dayMonth, active && styles.chipTextActive, !available && styles.dayTextDisabled]}>{d.month}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={[typography.h3, styles.sectionTitle]}>Choisir une heure</Text>
            {!selectedDate ? (
              <Text style={styles.slotHint}>Choisissez d'abord une date.</Text>
            ) : selectedSlots.length === 0 ? (
              <Text style={styles.slotHint}>Aucun créneau disponible ce jour. Essayez une autre date.</Text>
            ) : (
              <View style={styles.timeGrid}>
                {selectedSlots.map((t) => {
                  const active = selectedTime === t;
                  return (
                    <Pressable key={t} onPress={() => setSelectedTime(t)} style={[styles.timeChip, active && styles.chipActive]}>
                      <Text style={[styles.timeText, active && styles.chipTextActive]}>{t}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}

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

        <ReviewsSection
          kind="doctor"
          targetId={doctor.id}
          ratingAvg={doctor.rating_avg}
          ratingCount={doctor.rating_count}
          onChanged={reloadDoctor}
        />
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
  dayChipDisabled: { opacity: 0.4, backgroundColor: colors.surface, borderColor: colors.border },
  dayWeekday: { ...typography.caption, color: colors.textMuted, textTransform: "capitalize" },
  dayNumber: { ...typography.h3 },
  dayMonth: { ...typography.caption, color: colors.textMuted, textTransform: "capitalize" },
  dayTextDisabled: { color: colors.textMuted },
  slotHint: { ...typography.caption, color: colors.textMuted },
  noAvailCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  noAvailText: { ...typography.body, color: colors.textMuted, flex: 1 },
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
