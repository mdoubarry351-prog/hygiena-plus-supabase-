import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";
import {
  appointmentsService,
  dayKeyForDate,
  dayAvailability,
  daySlots,
  hasAnyAvailability,
  formatAppointmentTime,
  isSlotConflict,
  type DoctorWithProfile,
} from "@/lib/appointments-service";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { useToast } from "@/providers/ToastProvider";
import { colors, radius, spacing, typography } from "@/theme";

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
type DayOption = { date: string; weekday: string; day: string };
function buildDays(): DayOption[] {
  const out: DayOption[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({ date: toISO(d), weekday: d.toLocaleDateString("fr-FR", { weekday: "short" }), day: String(d.getDate()) });
  }
  return out;
}

/**
 * Modale de report d'un rendez-vous : sélection date + créneau RÉEL du médecin
 * (mêmes helpers que la prise de RDV), en excluant le créneau actuel.
 */
export function RescheduleModal({
  appointmentId,
  doctorId,
  currentDate,
  currentTime,
  onClose,
  onDone,
}: {
  appointmentId: string;
  doctorId: string;
  currentDate: string;
  currentTime: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [doctor, setDoctor] = useState<DoctorWithProfile | null>(null);
  const [bookedSet, setBookedSet] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const days = useMemo(buildDays, []);
  const todayISO = useMemo(() => toISO(new Date()), []);
  const currentKey = `${currentDate}|${formatAppointmentTime(currentTime)}`;

  const refreshSlots = useCallback(async () => {
    const slots = await appointmentsService.getBookedSlots(doctorId, days[0].date, days[days.length - 1].date);
    const set = new Set(slots.map((s) => `${s.date}|${s.time}`));
    set.delete(currentKey); // le créneau actuel ne se bloque pas lui-même
    setBookedSet(set);
  }, [doctorId, days, currentKey]);

  useEffect(() => {
    (async () => {
      try {
        const [d] = await Promise.all([appointmentsService.getDoctor(doctorId), refreshSlots()]);
        setDoctor(d);
      } catch {
        setDoctor(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [doctorId, refreshSlots]);

  const availabilityDefined = doctor ? hasAnyAvailability(doctor.availability) : false;

  const selectedSlots = useMemo(() => {
    if (!selectedDate || !doctor) return [];
    let slots = daySlots(doctor.availability, dayKeyForDate(selectedDate)).filter((t) => !bookedSet.has(`${selectedDate}|${t}`));
    if (selectedDate === todayISO) {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      slots = slots.filter((t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m > nowMin; });
    }
    return slots;
  }, [selectedDate, doctor, bookedSet, todayISO]);

  async function confirm() {
    if (!selectedDate || !selectedTime) return;
    setSaving(true);
    try {
      await appointmentsService.rescheduleAppointment(appointmentId, selectedDate, selectedTime);
      hapticSuccess();
      onDone();
    } catch (e) {
      if (isSlotConflict(e)) {
        hapticError();
        await refreshSlots();
        setSelectedTime(null);
        toast.error("Ce créneau vient d'être réservé, choisissez-en un autre.");
      } else {
        toast.error(e instanceof Error ? e.message : "Report échoué");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} transparent={false}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.header}>
          <Text style={typography.h2}>Reporter le rendez-vous</Text>
          <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
        </View>

        {loading ? (
          <Loading />
        ) : !availabilityDefined ? (
          <View style={styles.center}>
            <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
            <Text style={styles.muted}>Ce médecin n'a pas défini ses disponibilités.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <Text style={[typography.h3, styles.sectionTitle]}>Choisir une date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
              {days.map((d) => {
                const available = doctor ? dayAvailability(doctor.availability, dayKeyForDate(d.date)) !== null : false;
                const active = selectedDate === d.date;
                return (
                  <Pressable
                    key={d.date}
                    disabled={!available}
                    onPress={() => { setSelectedDate(d.date); setSelectedTime(null); }}
                    style={[styles.dayChip, active && styles.chipActive, !available && styles.dayChipDisabled]}
                  >
                    <Text style={[styles.dayWeekday, active && styles.chipTextActive]}>{d.weekday}</Text>
                    <Text style={[styles.dayNumber, active && styles.chipTextActive]}>{d.day}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={[typography.h3, styles.sectionTitle]}>Choisir une heure</Text>
            {!selectedDate ? (
              <Text style={styles.hint}>Choisissez d'abord une date.</Text>
            ) : selectedSlots.length === 0 ? (
              <Text style={styles.hint}>Aucun créneau disponible ce jour.</Text>
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

            <Button
              title="Confirmer le report"
              onPress={confirm}
              loading={saving}
              disabled={!selectedDate || !selectedTime}
            />
            <Button title="Annuler" variant="outline" onPress={onClose} />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm, paddingBottom: spacing.sm },
  content: { paddingBottom: spacing.xxl, gap: spacing.sm },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  muted: { ...typography.body, color: colors.textMuted, textAlign: "center" },
  sectionTitle: { marginTop: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted },
  dayRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  dayChip: {
    width: 60, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: "center", gap: 2,
  },
  dayChipDisabled: { opacity: 0.4 },
  dayWeekday: { ...typography.caption, color: colors.textMuted, textTransform: "capitalize" },
  dayNumber: { ...typography.h3 },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  timeChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
  timeText: { ...typography.body, fontWeight: "600" },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipTextActive: { color: colors.white },
});
