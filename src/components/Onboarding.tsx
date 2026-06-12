import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/providers/AuthProvider";
import { authService } from "@/lib/auth-service";
import { cycleService } from "@/lib/cycle-service";
import { colors, radius, spacing, typography } from "@/theme";

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

type Slide = { icon: keyof typeof Ionicons.glyphMap; title: string; text: string };
const SLIDES: Slide[] = [
  { icon: "calendar-outline", title: "Suis ton cycle en toute simplicité", text: "Calendrier, prédictions et rappels personnalisés." },
  { icon: "medkit-outline", title: "Des conseils de médecins vérifiées", text: "Pose tes questions et prends rendez-vous en clinique." },
  { icon: "chatbubbles-outline", title: "Une communauté bienveillante", text: "Échange en toute confidentialité — anonyme si tu veux." },
];

/**
 * Onboarding première ouverture (rôle 'user' uniquement) : 3 écrans d'intro
 * puis une 1ʳᵉ saisie (dernières règles). Marque onboarding_completed=true à
 * la fin, que la saisie soit faite ou sautée.
 */
export function Onboarding() {
  const { session, refreshProfile } = useAuth();
  const [step, setStep] = useState(0); // 0..2 = intro, 3 = saisie
  const [startDate, setStartDate] = useState(toISODate(new Date()));
  const [cycleLen, setCycleLen] = useState("28");
  const [saving, setSaving] = useState(false);

  async function complete(withCycle: boolean) {
    if (!session?.user) return;
    if (withCycle && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      Alert.alert("Date invalide", "Format attendu : AAAA-MM-JJ (ex. 2026-06-08)");
      return;
    }
    setSaving(true);
    try {
      if (withCycle) {
        const len = Number(cycleLen.replace(/\s/g, ""));
        await cycleService.addCycle({
          user_id: session.user.id,
          period_start: startDate,
          cycle_length: Number.isFinite(len) && len > 0 ? len : null,
        });
      }
      await authService.updateProfile(session.user.id, { onboarding_completed: true });
      await refreshProfile(); // → le gate se referme tout seul
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Action impossible");
    } finally {
      setSaving(false);
    }
  }

  // ----- Écrans d'intro -----
  if (step < 3) {
    const s = SLIDES[step];
    return (
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
          <View style={styles.skipRow}>
            <Pressable onPress={() => setStep(3)} hitSlop={8}>
              <Text style={styles.skip}>Passer</Text>
            </Pressable>
          </View>

          <View style={styles.center}>
            <View style={styles.iconWrap}>
              <Ionicons name={s.icon} size={56} color={colors.primaryDark} />
            </View>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.text}>{s.text}</Text>

            <View style={styles.dots}>
              {SLIDES.map((_, i) => (
                <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
              ))}
            </View>
          </View>

          <View style={styles.footer}>
            <Button title={step < 2 ? "Suivant" : "Commencer"} onPress={() => setStep(step + 1)} />
            {step > 0 ? (
              <Button title="Précédent" variant="outline" onPress={() => setStep(step - 1)} />
            ) : null}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ----- 1ʳᵉ saisie -----
  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>
          <View style={styles.iconWrapSmall}>
            <Ionicons name="water-outline" size={40} color={colors.primaryDark} />
          </View>
          <Text style={styles.title}>Quand ont commencé tes dernières règles ?</Text>
          <Text style={styles.text}>Cela nous permet de personnaliser tes prédictions dès maintenant.</Text>

          <Input
            label="Date de début (AAAA-MM-JJ)"
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2026-06-08"
            autoCapitalize="none"
          />
          <Input
            label="Durée moyenne du cycle (jours)"
            value={cycleLen}
            onChangeText={setCycleLen}
            placeholder="28"
            keyboardType="numeric"
          />

          <Button title="Valider" onPress={() => complete(true)} loading={saving} />
          <Pressable onPress={() => complete(false)} style={styles.later} disabled={saving}>
            <Text style={styles.laterText}>Plus tard</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.background, zIndex: 900 },
  safe: { flex: 1, paddingHorizontal: spacing.xl },
  skipRow: { alignItems: "flex-end", paddingTop: spacing.sm },
  skip: { ...typography.body, color: colors.textMuted, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  iconWrap: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  iconWrapSmall: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: spacing.sm },
  title: { ...typography.h1, fontSize: 24, textAlign: "center" },
  text: { ...typography.body, color: colors.textMuted, textAlign: "center", lineHeight: 22 },
  dots: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 22, backgroundColor: colors.primary },
  footer: { gap: spacing.sm, paddingBottom: spacing.lg },
  formContent: { flexGrow: 1, justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  later: { alignItems: "center", paddingVertical: spacing.sm },
  laterText: { ...typography.body, color: colors.primary, fontWeight: "700" },
});
