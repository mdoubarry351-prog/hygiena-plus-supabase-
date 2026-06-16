import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { Avatar } from "@/components/Avatar";
import { FadeInView } from "@/components/FadeInView";
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
  isSlotConflict,
  WEEK_DAYS,
  type DoctorWithProfile,
} from "@/lib/appointments-service";
import { VerifiedDoctorBadge } from "@/components/CommunityBadges";
import { formatPrice } from "@/lib/marketplace-service";
import { hapticLight, hapticSuccess, hapticError } from "@/lib/haptics";
import { resyncAppointmentReminders } from "@/lib/reminders";
import { colors, durations, fonts, radius, spacing, typography } from "@/theme";

// Calendrier mensuel (cohérent avec cycle/calendar.tsx : semaine Lun→Dim).
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const SLIDE = 26; // amplitude du glissement horizontal entre deux mois
const MONTHS_AHEAD = 2; // nombre de mois navigables au-delà du mois courant
const STEP = 55; // pas de l'apparition échelonnée (cohérent Vagues 1-4)

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BookAppointment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session, profile, role } = useAuth();
  const { appointments_enabled, premium_enabled, messaging_enabled } = useAppSettings();

  const [doctor, setDoctor] = useState<DoctorWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const todayISO = useMemo(() => toISO(new Date()), []);
  const [bookedSet, setBookedSet] = useState<Set<string>>(new Set());

  // Mois affiché (1er du mois) + bornes de navigation (mois courant → +MONTHS_AHEAD).
  const [viewMonth, setViewMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const monthFloor = useMemo(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); }, []);
  const monthCeil = useMemo(() => new Date(monthFloor.getFullYear(), monthFloor.getMonth() + MONTHS_AHEAD, 1), [monthFloor]);
  const canPrev = viewMonth > monthFloor;
  const canNext = viewMonth < monthCeil;

  // Plage des créneaux occupés à charger : mois courant → fin de (mois courant + MONTHS_AHEAD).
  const range = useMemo(() => ({
    from: toISO(monthFloor),
    to: toISO(new Date(monthFloor.getFullYear(), monthFloor.getMonth() + MONTHS_AHEAD + 1, 0)),
  }), [monthFloor]);

  // Animation de transition entre mois (fondu + slide), native driver.
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const animating = useRef(false);

  // Récupère les créneaux occupés du médecin sur toute la plage navigable.
  const refreshSlots = useCallback(async () => {
    try {
      const slots = await appointmentsService.getBookedSlots(id, range.from, range.to);
      setBookedSet(new Set(slots.map((s) => `${s.date}|${s.time}`)));
    } catch {
      setBookedSet(new Set());
    }
  }, [id, range.from, range.to]);

  useEffect(() => { refreshSlots(); }, [refreshSlots]);

  // Créneaux d'une date : disponibilité du jour − occupés − passés (logique inchangée).
  const slotsForDate = useCallback((dateISO: string): string[] => {
    if (!doctor) return [];
    const avail = dayAvailability(doctor.availability, dayKeyForDate(dateISO));
    if (!avail) return [];
    let slots = generateSlots(avail.start, avail.end).filter((t) => !bookedSet.has(`${dateISO}|${t}`));
    if (dateISO === todayISO) {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      slots = slots.filter((t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m > nowMin; });
    }
    return slots;
  }, [doctor, bookedSet, todayISO]);

  const selectedSlots = useMemo(() => (selectedDate ? slotsForDate(selectedDate) : []), [selectedDate, slotsForDate]);

  // Grille du mois affiché (semaine Lun→Dim, cases vides en tête).
  const grid = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const first = new Date(year, month, 1);
    const startWeekday = (first.getDay() + 6) % 7; // Lundi = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [viewMonth]);

  // Change de mois avec animation (fondu + slide), borné [mois courant, +MONTHS_AHEAD].
  const changeMonth = useCallback((delta: number) => {
    if (animating.current) return;
    const target = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1);
    if (target < monthFloor || target > monthCeil) return;
    animating.current = true;
    hapticLight();
    const out = delta > 0 ? -SLIDE : SLIDE;
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: durations.fast, useNativeDriver: true }),
      Animated.timing(slide, { toValue: out, duration: durations.fast, useNativeDriver: true }),
    ]).start(() => {
      slide.setValue(-out);
      setViewMonth(target);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: durations.normal, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: durations.normal, useNativeDriver: true }),
      ]).start(() => { animating.current = false; });
    });
  }, [viewMonth, monthFloor, monthCeil, fade, slide]);

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
      hapticSuccess();
      Alert.alert(
        "Rendez-vous demandé",
        `Ta demande avec ${name} le ${formatAppointmentDate(selectedDate)} à ${selectedTime} a été envoyée. Tu seras notifiée dès sa confirmation.`,
        [{ text: "OK", onPress: () => router.replace("/(user)/appointments/mine") }]
      );
    } catch (e) {
      if (isSlotConflict(e)) {
        hapticError();
        await refreshSlots();
        setSelectedTime(null);
        Alert.alert("Créneau indisponible", "Ce créneau vient d'être réservé, choisis-en un autre.");
      } else {
        Alert.alert("Erreur", e instanceof Error ? e.message : "Prise de rendez-vous échouée");
      }
    } finally {
      setSaving(false);
    }
  }

  // Messagerie premium : conseils en ligne (≠ consultation, qui passe par un RDV).
  function handleMessage() {
    // Messagerie/téléconsultation désactivée par l'admin (ou Premium désactivé).
    if (!messaging_enabled || !premium_enabled) return showServiceUnavailable();
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
      hapticSuccess();
      resyncAppointmentReminders(session.user.id); // planifie le rappel local (silencieux)
      router.replace({ pathname: "/(user)/appointments/receipt", params: { id: created.id } });
    } catch (e) {
      if (isSlotConflict(e)) {
        hapticError();
        await refreshSlots();
        setSelectedTime(null);
        Alert.alert("Créneau indisponible", "Ce créneau vient d'être réservé, choisis-en un autre.");
      } else {
        Alert.alert("Erreur", e instanceof Error ? e.message : "Paiement échoué");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.fill}>
      <ScreenHeader title="Prendre rendez-vous" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* En-tête profil */}
        <FadeInView fill={false} delay={0}>
        <Card style={styles.doctorCard}>
          <Avatar uri={doctor.profile?.avatar_url} name={name} size={AVATAR} />
          <View style={styles.doctorInfo}>
            <View style={styles.nameRow}>
              <Text style={typography.h3} numberOfLines={1}>{name}</Text>
              {doctor.is_validated ? <VerifiedDoctorBadge /> : null}
            </View>
            <Text style={styles.specialty}>{doctor.specialty}</Text>
            {doctor.clinic_name ? (
              <View style={styles.metaLine}>
                <Ionicons name="business-outline" size={14} color={colors.textMuted} />
                <Text style={styles.metaText} numberOfLines={1}>{doctor.clinic_name}</Text>
              </View>
            ) : null}
            {doctor.years_experience > 0 ? (
              <View style={styles.metaLine}>
                <Ionicons name="ribbon-outline" size={14} color={colors.textMuted} />
                <Text style={styles.metaText}>{doctor.years_experience} an{doctor.years_experience > 1 ? "s" : ""} d'expérience</Text>
              </View>
            ) : null}
            <StarRating value={doctor.rating_avg} count={doctor.rating_count} size={14} compact />
            {doctor.consultation_fee != null ? (
              <Text style={styles.fee}>{formatPrice(doctor.consultation_fee)}</Text>
            ) : null}
          </View>
        </Card>
        </FadeInView>

        <FadeInView fill={false} delay={STEP} style={styles.group}>
        <MedicalDisclaimer text="La consultation se fait en clinique ; la messagerie en ligne ne remplace pas un examen médical." />

        {/* À propos */}
        {doctor.bio ? (
          <Card style={styles.bioCard}>
            <Text style={typography.h3}>À propos</Text>
            <Text style={[typography.body, styles.muted]}>{doctor.bio}</Text>
          </Card>
        ) : null}

        {/* Aperçu des disponibilités */}
        {availabilityDefined ? (
          <Card style={styles.bioCard}>
            <Text style={typography.h3}>Disponibilités</Text>
            {WEEK_DAYS.map((d) => {
              const avail = dayAvailability(doctor.availability, d.key);
              if (!avail) return null;
              return (
                <View key={d.key} style={styles.availRow}>
                  <Text style={styles.availDay}>{d.label}</Text>
                  <Text style={styles.availHours}>{avail.start}–{avail.end}</Text>
                </View>
              );
            })}
          </Card>
        ) : null}

        <Pressable onPress={() => { hapticLight(); handleMessage(); }} style={({ pressed }) => [styles.msgBtn, pressed && styles.msgBtnPressed]} accessibilityRole="button" accessibilityLabel="Écrire au médecin">
          <Ionicons name="chatbubbles-outline" size={18} color={colors.primary} />
          <Text style={styles.msgBtnText}>Écrire au médecin (conseils)</Text>
          {!profile?.is_premium ? <Ionicons name="star" size={14} color={colors.accent} /> : null}
        </Pressable>
        <Text style={styles.msgNote}>
          Conseils en ligne (Premium). Pour une consultation, prends rendez-vous ci-dessous.
        </Text>
        </FadeInView>

        <FadeInView fill={false} delay={STEP * 2} style={styles.group}>
        {!availabilityDefined ? (
          <Card style={styles.noAvailCard}>
            <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
            <Text style={styles.noAvailText}>Ce médecin n'a pas encore défini ses disponibilités.</Text>
          </Card>
        ) : (
          <>
            <Text style={[typography.h3, styles.sectionTitle]}>Choisir une date</Text>
            <Card style={styles.calCard}>
              <View style={styles.calHeader}>
                <Pressable onPress={() => changeMonth(-1)} disabled={!canPrev} hitSlop={12} style={({ pressed }) => [styles.calNavBtn, pressed && canPrev && styles.navPressed]} accessibilityRole="button" accessibilityLabel="Mois précédent">
                  <Ionicons name="chevron-back" size={22} color={canPrev ? colors.primary : colors.border} />
                </Pressable>
                <Animated.Text style={[styles.calMonth, { opacity: fade }]}>{MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}</Animated.Text>
                <Pressable onPress={() => changeMonth(1)} disabled={!canNext} hitSlop={12} style={({ pressed }) => [styles.calNavBtn, pressed && canNext && styles.navPressed]} accessibilityRole="button" accessibilityLabel="Mois suivant">
                  <Ionicons name="chevron-forward" size={22} color={canNext ? colors.primary : colors.border} />
                </Pressable>
              </View>

              <View style={styles.calWeekRow}>
                {WEEKDAYS.map((w, i) => <Text key={i} style={styles.calWeekday}>{w}</Text>)}
              </View>

              <Animated.View style={[styles.calGrid, { opacity: fade, transform: [{ translateX: slide }] }]}>
                {grid.map((d, i) => {
                  if (!d) return <View key={i} style={styles.calCell} />;
                  const iso = toISO(d);
                  const isPast = iso < todayISO;
                  const hasAvail = dayAvailability(doctor.availability, dayKeyForDate(iso)) !== null;
                  const full = hasAvail && !isPast && slotsForDate(iso).length === 0;
                  const disabled = isPast || !hasAvail || full;
                  const active = selectedDate === iso;
                  return (
                    <View key={i} style={styles.calCell}>
                      <Pressable
                        disabled={disabled}
                        onPress={() => { hapticLight(); setSelectedDate(iso); setSelectedTime(null); }}
                        style={({ pressed }) => [styles.calDay, active && styles.calDayActive, full && styles.calDayFull, pressed && !disabled && !active && styles.calDayPressed]}
                        accessibilityRole="button"
                        accessibilityLabel={`${d.getDate()} ${MONTHS[d.getMonth()]}${disabled ? " (indisponible)" : ""}`}
                      >
                        <Text style={[styles.calDayText, active && styles.calDayTextActive, disabled && styles.calDayTextDisabled, full && styles.calDayTextFull]}>{d.getDate()}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </Animated.View>

              <Text style={styles.calLegend}>Jours grisés : indisponibles · barrés : complets.</Text>
            </Card>

            <Text style={[typography.h3, styles.sectionTitle]}>Choisir une heure</Text>
            {!selectedDate ? (
              <Text style={styles.slotHint}>Choisis d'abord une date.</Text>
            ) : selectedSlots.length === 0 ? (
              <Text style={styles.slotHint}>Aucun créneau disponible ce jour. Essaie une autre date.</Text>
            ) : (
              <View style={styles.timeGrid}>
                {selectedSlots.map((t) => {
                  const active = selectedTime === t;
                  return (
                    <Pressable key={t} onPress={() => { hapticLight(); setSelectedTime(t); }} style={({ pressed }) => [styles.timeChip, active && styles.chipActive, pressed && !active && styles.timeChipPressed]} accessibilityRole="button" accessibilityLabel={`Créneau ${t}`}>
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
          <Text style={[styles.summary, styles.muted]}>Sélectionne une date et une heure.</Text>
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
        </FadeInView>

        <FadeInView fill={false} delay={STEP * 3}>
          <ReviewsSection
            kind="doctor"
            targetId={doctor.id}
            ratingAvg={doctor.rating_avg}
            ratingCount={doctor.rating_count}
            onChanged={reloadDoctor}
          />
        </FadeInView>
      </ScrollView>
      </View>
    </Screen>
  );
}

const AVATAR = 64;
const styles = StyleSheet.create({
  fill: { flex: 1 },
  group: { gap: spacing.md },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  doctorCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: radius.pill, backgroundColor: colors.primaryLight },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 26, fontWeight: "700", color: colors.primaryDark },
  doctorInfo: { flex: 1, gap: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  specialty: { ...typography.caption, color: colors.secondary, fontWeight: "600" },
  metaLine: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metaText: { ...typography.caption, color: colors.textMuted, flex: 1 },
  fee: { ...typography.body, fontWeight: "700", color: colors.primary, marginTop: spacing.xs },
  bioCard: { gap: spacing.sm },
  availRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 2 },
  availDay: { ...typography.body, fontWeight: "600", color: colors.text },
  availHours: { ...typography.body, color: colors.textMuted },
  muted: { color: colors.textMuted },
  sectionTitle: { marginTop: spacing.sm },
  calCard: { gap: spacing.sm },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calNavBtn: { padding: spacing.xs },
  navPressed: { opacity: 0.5 },
  calMonth: { ...typography.h3, textTransform: "capitalize" },
  calWeekRow: { flexDirection: "row" },
  calWeekday: { flex: 1, textAlign: "center", ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  calDay: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  calDayActive: { backgroundColor: colors.primary },
  calDayPressed: { backgroundColor: colors.primaryLight },
  calDayFull: { backgroundColor: colors.surface },
  calDayText: { ...typography.body, color: colors.text },
  calDayTextActive: { color: colors.white, fontWeight: "700" },
  calDayTextDisabled: { color: colors.textMuted, opacity: 0.45 },
  calDayTextFull: { textDecorationLine: "line-through", color: colors.textMuted, opacity: 0.7 },
  calLegend: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
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
  timeChipPressed: { opacity: 0.6, backgroundColor: colors.primaryLight, borderColor: colors.primary },
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
  msgBtnPressed: { opacity: 0.6, backgroundColor: colors.primaryLight },
  msgBtnText: { ...typography.body, color: colors.primary, fontFamily: fonts.bodySemiBold },
  msgNote: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
});
