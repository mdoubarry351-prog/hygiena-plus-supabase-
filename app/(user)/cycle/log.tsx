import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { Input } from "@/components/Input";
import { Loading } from "@/components/Loading";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { cycleService, SYMPTOMS, FLOW_OPTIONS, MOOD_OPTIONS } from "@/lib/cycle-service";
import { colors, radius, spacing, typography } from "@/theme";

// Parse une date SQL « AAAA-MM-JJ » en Date locale (midi → évite les décalages DST/fuseau).
function parseISODate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

// Format date en YYYY-MM-DD à partir des composants LOCAUX (évite le décalage de
// fuseau qu'introduirait toISOString() pour les minuits locaux).
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Libellé lisible (« dim. 14 juin 2026 ») pour les boutons de date.
function formatDateLabel(d: Date): string {
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

// Repère qualitatif pour l'échelle de douleur 0-10.
function painDescriptor(p: number): string {
  if (p === 0) return "aucune";
  if (p <= 3) return "légère";
  if (p <= 6) return "modérée";
  if (p <= 9) return "forte";
  return "intense";
}

export default function LogCycle() {
  const { session } = useAuth();
  const toast = useToast();
  const router = useRouter();
  // En mode édition, `id` est l'id de la saisie à modifier (sinon création).
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [picker, setPicker] = useState<"start" | "end" | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [flow, setFlow] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [pain, setPain] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingCycle, setLoadingCycle] = useState(isEdit);

  // Édition : charge la saisie existante et préremplit le formulaire.
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const c = await cycleService.getCycle(id!);
        if (c) {
          setStartDate(parseISODate(c.period_start));
          setEndDate(c.period_end ? parseISODate(c.period_end) : null);
          setSelectedSymptoms(c.symptoms ?? []);
          setFlow(c.flow);
          setMood(c.mood);
          setPain(c.pain);
          setNotes(c.notes ?? "");
        } else {
          Alert.alert("Introuvable", "Cette saisie n'existe plus.", [{ text: "OK", onPress: () => router.back() }]);
        }
      } catch {
        Alert.alert("Erreur", "Impossible de charger la saisie.", [{ text: "OK", onPress: () => router.back() }]);
      } finally {
        setLoadingCycle(false);
      }
    })();
  }, [isEdit, id]);

  function toggleSymptom(s: string) {
    setSelectedSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  // Sélection unique désélectionnable (flux / humeur / douleur).
  const pickSingle = (current: string | null, value: string) => (current === value ? null : value);

  // Réception d'une date depuis le picker natif (gère iOS inline / Android modal).
  function onChangeDate(event: DateTimePickerEvent, selected?: Date) {
    // Android : le dialogue se ferme seul ; on referme aussi notre état.
    if (Platform.OS !== "ios") setPicker(null);
    if (event.type === "dismissed" || !selected) return;
    if (picker === "start") {
      setStartDate(selected);
      // Fin antérieure au nouveau début → on l'invalide.
      setEndDate((e) => (e && e < selected ? null : e));
    } else if (picker === "end") {
      setEndDate(selected);
    }
  }

  async function handleSave() {
    if (!session?.user) return;
    if (endDate && endDate < startDate) {
      Alert.alert("Dates incohérentes", "La date de fin doit être après la date de début.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        period_start: toISODate(startDate),
        period_end: endDate ? toISODate(endDate) : null,
        symptoms: selectedSymptoms.length ? selectedSymptoms : null,
        flow,
        mood,
        pain,
        notes: notes.trim() ? notes.trim() : null,
      };
      if (isEdit) {
        await cycleService.updateCycle(id!, payload);
        toast.success("Saisie modifiée.");
      } else {
        await cycleService.addCycle({ user_id: session.user.id, ...payload });
        toast.success("Vos règles ont été enregistrées.");
      }
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      const isNetwork = /network request failed|fetch|timeout|offline/i.test(msg);
      Alert.alert(
        isNetwork ? "Pas de connexion" : "Erreur",
        isNetwork ? "Pas de connexion — réessayez une fois en ligne." : (msg || "Enregistrement échoué")
      );
    } finally {
      setSaving(false);
    }
  }

  // Valeur affichée dans le picker quand on édite la fin sans date encore choisie.
  const pickerValue = picker === "end" ? endDate ?? startDate : startDate;

  if (loadingCycle) return <Loading />;

  return (
    <Screen>
      <ScreenHeader title={isEdit ? "Modifier la saisie" : "Enregistrer mes règles"} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Dates via picker natif */}
        <Text style={[typography.h3, styles.sectionTitle]}>Dates</Text>
        <Pressable onPress={() => setPicker("start")} style={styles.dateRow} accessibilityRole="button" accessibilityLabel="Choisir la date de début">
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          <View style={styles.dateText}>
            <Text style={styles.dateLabel}>Début des règles</Text>
            <Text style={styles.dateValue}>{formatDateLabel(startDate)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        <Pressable onPress={() => setPicker("end")} style={styles.dateRow} accessibilityRole="button" accessibilityLabel="Choisir la date de fin">
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          <View style={styles.dateText}>
            <Text style={styles.dateLabel}>Fin des règles (optionnel)</Text>
            <Text style={[styles.dateValue, !endDate && styles.dateValueMuted]}>
              {endDate ? formatDateLabel(endDate) : "Non renseignée"}
            </Text>
          </View>
          {endDate ? (
            <Pressable onPress={() => setEndDate(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Effacer la date de fin">
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          ) : (
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          )}
        </Pressable>

        {picker ? (
          <DateTimePicker
            value={pickerValue}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            maximumDate={new Date()}
            minimumDate={picker === "end" ? startDate : undefined}
            onChange={onChangeDate}
          />
        ) : null}
        {picker && Platform.OS === "ios" ? (
          <Button title="Terminé" variant="outline" size="sm" onPress={() => setPicker(null)} />
        ) : null}

        {/* Flux */}
        <Text style={[typography.h3, styles.sectionTitle]}>Flux</Text>
        <View style={styles.chips}>
          {FLOW_OPTIONS.map((f) => (
            <Chip key={f} label={f} active={flow === f} onPress={() => setFlow((c) => pickSingle(c, f))} variant="soft" size="lg" />
          ))}
        </View>

        {/* Humeur */}
        <Text style={[typography.h3, styles.sectionTitle]}>Humeur</Text>
        <View style={styles.chips}>
          {MOOD_OPTIONS.map((m) => (
            <Chip key={m} label={m} active={mood === m} onPress={() => setMood((c) => pickSingle(c, m))} variant="soft" size="lg" />
          ))}
        </View>

        {/* Douleur (échelle 0-10, sans dépendance) */}
        <View style={styles.painHead}>
          <Text style={typography.h3}>Douleur</Text>
          <Text style={styles.painValue}>
            {pain === null ? "Non renseignée" : `${pain}/10 · ${painDescriptor(pain)}`}
          </Text>
        </View>
        <View style={styles.painScale}>
          {Array.from({ length: 11 }, (_, n) => {
            const active = pain === n;
            return (
              <Pressable
                key={n}
                onPress={() => setPain((c) => (c === n ? null : n))}
                hitSlop={6}
                style={[styles.painDot, active && styles.painDotActive]}
                accessibilityRole="button"
                accessibilityLabel={`Douleur ${n} sur 10`}
              >
                <Text style={[styles.painDotText, active && styles.painDotTextActive]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.painLegend}>
          <Text style={styles.painLegendText}>0 · aucune</Text>
          <Text style={styles.painLegendText}>10 · intense</Text>
        </View>

        {/* Symptômes */}
        <Text style={[typography.h3, styles.sectionTitle]}>Symptômes</Text>
        <View style={styles.chips}>
          {SYMPTOMS.map((s) => (
            <Chip key={s} label={s} active={selectedSymptoms.includes(s)} onPress={() => toggleSymptom(s)} variant="soft" size="lg" />
          ))}
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
  dateRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  dateText: { flex: 1, gap: 2 },
  dateLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  dateValue: { ...typography.body, color: colors.text, fontWeight: "600" },
  dateValueMuted: { color: colors.textMuted, fontWeight: "400" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text },
  chipTextActive: { color: colors.primaryDark, fontWeight: "600" },
  painHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: spacing.md, marginBottom: spacing.xs },
  painValue: { ...typography.caption, color: colors.primaryDark, fontWeight: "700" },
  painScale: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  painDot: {
    width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  painDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  painDotText: { ...typography.caption, color: colors.text, fontWeight: "700" },
  painDotTextActive: { color: colors.white },
  painLegend: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  painLegendText: { ...typography.caption, color: colors.textMuted },
  notes: { height: 90, textAlignVertical: "top", paddingTop: spacing.sm },
});
