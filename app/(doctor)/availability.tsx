import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Loading } from "@/components/Loading";
import { useToast } from "@/providers/ToastProvider";
import { FadeInView } from "@/components/FadeInView";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { useMyDoctor } from "@/hooks/useMyDoctor";
import {
  doctorService,
  parseAvailability,
  WEEKDAYS,
  type WeeklyAvailability,
  type DayKey,
} from "@/lib/doctor-service";
import { colors, radius, spacing, typography } from "@/theme";

export default function DoctorAvailability() {
  const { doctor, loading } = useMyDoctor();
  const toast = useToast();
  const [week, setWeek] = useState<WeeklyAvailability | null>(null);
  const [saving, setSaving] = useState(false);

  // Initialise le formulaire dès que la fiche est chargée.
  useEffect(() => {
    if (doctor) setWeek(parseAvailability(doctor.availability));
  }, [doctor]);

  if (loading || !week) return <Loading />;

  function setDay(key: DayKey, patch: Partial<WeeklyAvailability[DayKey]>) {
    setWeek((prev) => (prev ? { ...prev, [key]: { ...prev[key], ...patch } } : prev));
  }

  async function handleSave() {
    if (!doctor || !week) return;
    setSaving(true);
    try {
      await doctorService.updateAvailability(doctor.id, week);
      hapticSuccess();
      toast.success("Disponibilités enregistrées.");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Enregistrement échoué");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={typography.h2}>Disponibilité</Text>
        <Text style={[typography.body, styles.muted]}>
          Indiquez vos jours et plages horaires de consultation.
        </Text>

        {WEEKDAYS.map(({ key, label }, i) => {
          const day = week[key];
          return (
            <FadeInView key={key} fill={false} delay={Math.min(i, 6) * 45}>
            <Card style={styles.dayCard}>
              <View style={styles.dayHead}>
                <Text style={styles.dayLabel}>{label}</Text>
                <Switch
                  value={day.enabled}
                  onValueChange={(v) => { hapticLight(); setDay(key, { enabled: v }); }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>
              {day.enabled ? (
                <Input
                  value={day.hours}
                  onChangeText={(t) => setDay(key, { hours: t })}
                  placeholder="Ex. 09:00 - 12:00, 14:00 - 17:00"
                  autoCapitalize="none"
                  style={styles.hoursInput}
                />
              ) : (
                <View style={styles.closedRow}>
                  <Ionicons name="moon-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.closedText}>Indisponible</Text>
                </View>
              )}
            </Card>
            </FadeInView>
          );
        })}

        <Button title="Enregistrer" onPress={handleSave} loading={saving} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  muted: { color: colors.textMuted, marginBottom: spacing.sm },
  dayCard: { gap: spacing.sm },
  dayHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayLabel: { ...typography.name },
  hoursInput: { marginBottom: 0 },
  closedRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  closedText: { ...typography.caption, color: colors.textMuted },
});
