import { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/providers/AuthProvider";
import { cycleService, SYMPTOMS } from "@/lib/cycle-service";
import { colors, radius, spacing, typography } from "@/theme";

// Helper: format date en YYYY-MM-DD (format attendu par Postgres "date")
function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function LogCycle() {
  const { session } = useAuth();
  const router = useRouter();

  const [startDate, setStartDate] = useState(toISODate(new Date()));
  const [endDate, setEndDate] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleSymptom(s: string) {
    setSelectedSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function handleSave() {
    if (!session?.user) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      Alert.alert("Date invalide", "Format attendu : AAAA-MM-JJ (ex. 2026-06-08)");
      return;
    }
    setSaving(true);
    try {
      await cycleService.addCycle({
        user_id: session.user.id,
        period_start: startDate,
        period_end: endDate.trim() ? endDate.trim() : null,
        symptoms: selectedSymptoms.length ? selectedSymptoms : null,
        notes: notes.trim() ? notes.trim() : null,
      });
      Alert.alert("Enregistré", "Vos règles ont été enregistrées.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Enregistrement échoué");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={typography.h2}>Enregistrer mes règles</Text>

        <Input
          label="Date de début (AAAA-MM-JJ)"
          value={startDate}
          onChangeText={setStartDate}
          placeholder="2026-06-08"
          autoCapitalize="none"
        />
        <Input
          label="Date de fin (optionnel)"
          value={endDate}
          onChangeText={setEndDate}
          placeholder="2026-06-12"
          autoCapitalize="none"
        />

        <Text style={[typography.h3, styles.sectionTitle]}>Symptômes</Text>
        <View style={styles.chips}>
          {SYMPTOMS.map((s) => {
            const active = selectedSymptoms.includes(s);
            return (
              <Pressable
                key={s}
                onPress={() => toggleSymptom(s)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
              </Pressable>
            );
          })}
        </View>

        <Input
          label="Notes (optionnel)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Comment vous sentez-vous ?"
          multiline
          numberOfLines={3}
          style={styles.notes}
        />

        <Button title="Enregistrer" onPress={handleSave} loading={saving} />
        <Button title="Annuler" variant="outline" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  sectionTitle: { marginTop: spacing.md, marginBottom: spacing.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text },
  chipTextActive: { color: colors.primaryDark, fontWeight: "600" },
  notes: { height: 90, textAlignVertical: "top", paddingTop: spacing.sm },
});
