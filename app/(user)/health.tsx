import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Loading } from "@/components/Loading";
import { FadeInView } from "@/components/FadeInView";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { authService } from "@/lib/auth-service";
import { healthService, BLOOD_GROUPS } from "@/lib/health-service";
import { colors, radius, spacing, typography } from "@/theme";

// Date locale « AAAA-MM-JJ » (composants locaux → pas de décalage de fuseau).
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseISODate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}
function formatDateLabel(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
// Âge en années à partir d'une date de naissance.
function ageFrom(d: Date): number {
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export default function HealthInfo() {
  const { profile, session, refreshProfile } = useAuth();
  const toast = useToast();

  const [dob, setDob] = useState<Date | null>(profile?.date_of_birth ? parseISODate(profile.date_of_birth) : null);
  const [showPicker, setShowPicker] = useState(false);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [bloodGroup, setBloodGroup] = useState<string | null>(null);
  const [allergies, setAllergies] = useState("");
  const [treatments, setTreatments] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Charge la fiche santé existante (peut être vide → champs vides, sans erreur).
  useEffect(() => {
    if (!session?.user) return;
    let alive = true;
    (async () => {
      try {
        const h = await healthService.getHealthProfile(session.user.id);
        if (alive && h) {
          setHeight(h.height_cm != null ? String(h.height_cm) : "");
          setWeight(h.weight_kg != null ? String(h.weight_kg) : "");
          setBloodGroup(h.blood_group);
          setAllergies(h.allergies ?? "");
          setTreatments(h.treatments ?? "");
          setNotes(h.health_notes ?? "");
        }
      } catch {
        // fiche absente / lecture impossible → on garde l'écran vide
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [session?.user]);

  function onChangeDob(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS !== "ios") setShowPicker(false);
    if (event.type === "dismissed" || !selected) return;
    setDob(selected);
  }

  async function handleSave() {
    if (!session?.user) return;
    const userId = session.user.id;
    const h = height.trim() ? parseInt(height.replace(/\s/g, ""), 10) : null;
    const w = weight.trim() ? parseFloat(weight.replace(",", ".").replace(/\s/g, "")) : null;
    if (h != null && (Number.isNaN(h) || h <= 0 || h > 300)) { Alert.alert("Taille invalide", "Indiquez une taille en cm (1–300)."); return; }
    if (w != null && (Number.isNaN(w) || w <= 0 || w > 500)) { Alert.alert("Poids invalide", "Indiquez un poids en kg (1–500)."); return; }
    setSaving(true);
    try {
      const nextDob = dob ? toISODate(dob) : null;
      if (nextDob !== (profile?.date_of_birth ?? null)) {
        await authService.updateProfile(userId, { date_of_birth: nextDob });
      }
      await healthService.upsertHealthProfile(userId, {
        height_cm: h,
        weight_kg: w,
        blood_group: bloodGroup,
        allergies: allergies.trim() ? allergies.trim() : null,
        treatments: treatments.trim() ? treatments.trim() : null,
        health_notes: notes.trim() ? notes.trim() : null,
      });
      await refreshProfile();
      toast.success("Vos informations de santé ont été enregistrées.");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Enregistrement échoué");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <Screen>
      <FadeInView>
      <ScreenHeader title="Informations de santé" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.privacyRow}>
          <Ionicons name="lock-closed-outline" size={15} color={colors.primaryDark} />
          <Text style={styles.privacyText}>Ces informations sont privées et visibles uniquement par vous.</Text>
        </View>

        {/* Date de naissance + âge */}
        <Card style={styles.card}>
          <Text style={typography.h3}>Date de naissance</Text>
          <Pressable onPress={() => setShowPicker(true)} style={styles.dateRow} accessibilityRole="button" accessibilityLabel="Choisir la date de naissance">
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={[styles.dateValue, !dob && styles.dateValueMuted]}>
              {dob ? formatDateLabel(dob) : "Non renseignée"}
            </Text>
            {dob ? <Text style={styles.ageBadge}>{ageFrom(dob)} ans</Text> : null}
          </Pressable>
          {showPicker ? (
            <DateTimePicker
              value={dob ?? new Date(2000, 0, 1)}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              maximumDate={new Date()}
              onChange={onChangeDob}
            />
          ) : null}
          {showPicker && Platform.OS === "ios" ? (
            <Button title="Terminé" variant="outline" size="sm" onPress={() => setShowPicker(false)} />
          ) : null}
        </Card>

        {/* Mesures */}
        <Card style={styles.card}>
          <Text style={typography.h3}>Mesures</Text>
          <Input label="Taille (cm)" value={height} onChangeText={setHeight} placeholder="Ex. 165" keyboardType="numeric" />
          <Input label="Poids (kg)" value={weight} onChangeText={setWeight} placeholder="Ex. 60" keyboardType="numeric" />
        </Card>

        {/* Groupe sanguin */}
        <Card style={styles.card}>
          <Text style={typography.h3}>Groupe sanguin</Text>
          <View style={styles.chips}>
            {BLOOD_GROUPS.map((g) => (
              <Chip key={g} label={g} active={bloodGroup === g} onPress={() => setBloodGroup((c) => (c === g ? null : g))} size="lg" />
            ))}
          </View>
        </Card>

        {/* Antécédents */}
        <Card style={styles.card}>
          <Text style={typography.h3}>Antécédents</Text>
          <Input label="Allergies" value={allergies} onChangeText={setAllergies} placeholder="Ex. pénicilline, arachides…" multiline numberOfLines={2} style={styles.area} />
          <Input label="Traitements en cours" value={treatments} onChangeText={setTreatments} placeholder="Ex. contraception, supplément de fer…" multiline numberOfLines={2} style={styles.area} />
          <Input label="Notes santé" value={notes} onChangeText={setNotes} placeholder="Tout ce qui vous semble utile" multiline numberOfLines={3} style={styles.area} />
        </Card>

        <Button title="Enregistrer" onPress={handleSave} loading={saving} />
      </ScrollView>
      </FadeInView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  privacyRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.primaryLight, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  privacyText: { ...typography.caption, color: colors.primaryDark, flex: 1 },
  card: { gap: spacing.sm },
  dateRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  dateValue: { ...typography.body, color: colors.text, fontWeight: "600", flex: 1 },
  dateValueMuted: { color: colors.textMuted, fontWeight: "400" },
  ageBadge: { ...typography.caption, color: colors.primaryDark, fontWeight: "700", backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text, fontWeight: "700" },
  chipTextActive: { color: colors.white },
  area: { height: 80, textAlignVertical: "top", paddingTop: spacing.sm },
});
