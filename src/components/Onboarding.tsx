import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/providers/AuthProvider";
import { authService } from "@/lib/auth-service";
import { cycleService } from "@/lib/cycle-service";
import { colors, durations, phase as PHASE_COLOR, radius, spacing, typography } from "@/theme";

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

type Slide = { icon: keyof typeof Ionicons.glyphMap; tint: string; title: string; text: string };

// Bénéfices clés présentés à la première ouverture (cycle, médecins, communauté,
// boutique, confidentialité). Chaque écran a sa teinte (tokens uniquement).
const SLIDES: Slide[] = [
  { icon: "calendar-outline", tint: PHASE_COLOR.period, title: "Suis ton cycle en toute simplicité", text: "Calendrier, prédictions et rappels personnalisés, rien que pour toi." },
  { icon: "medkit-outline", tint: colors.primary, title: "Des médecins vérifiées à tes côtés", text: "Pose tes questions et prends rendez-vous en clinique en quelques taps." },
  { icon: "chatbubbles-outline", tint: colors.secondary, title: "Une communauté bienveillante", text: "Échange et trouve du soutien — anonyme si tu le souhaites." },
  { icon: "bag-handle-outline", tint: colors.accent, title: "Une boutique santé de confiance", text: "Produits d'hygiène et de bien-être livrés près de chez toi." },
  { icon: "lock-closed-outline", tint: colors.success, title: "Ta confidentialité avant tout", text: "Tes données sont protégées et ne sont jamais partagées sans ton accord." },
];

const LAST = SLIDES.length - 1;

// Point de pagination animé : largeur + couleur se fondent quand il (dé)devient
// actif. Animated RN (non-native driver pour width/color) → compatible Expo Go.
function Dot({ active }: { active: boolean }) {
  const p = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(p, { toValue: active ? 1 : 0, duration: durations.normal, useNativeDriver: false }).start();
  }, [active, p]);
  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: p.interpolate({ inputRange: [0, 1], outputRange: [8, 22] }),
          backgroundColor: p.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.primary] }),
        },
      ]}
    />
  );
}

/**
 * Onboarding première ouverture (rôle 'user' uniquement) : écrans d'intro
 * (bénéfices) avec transitions douces, puis une 1ʳᵉ saisie (dernières règles).
 * Marque onboarding_completed=true à la fin, que la saisie soit faite ou sautée.
 */
export function Onboarding() {
  const { session, refreshProfile } = useAuth();
  const [step, setStep] = useState(0); // 0..LAST = intro, SLIDES.length = saisie
  const [startDate, setStartDate] = useState(toISODate(new Date()));
  const [cycleLen, setCycleLen] = useState("28");
  const [saving, setSaving] = useState(false);

  // Entrée douce du slide courant (fondu + léger glissé) rejouée à chaque pas.
  const slideAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (step > LAST) return;
    slideAnim.setValue(0);
    Animated.timing(slideAnim, { toValue: 1, duration: durations.normal, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [step, slideAnim]);

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
  if (step <= LAST) {
    const s = SLIDES[step];
    const slideTranslate = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
    return (
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
          <View style={styles.skipRow}>
            <Pressable onPress={() => setStep(SLIDES.length)} hitSlop={8}>
              <Text style={styles.skip}>Passer</Text>
            </Pressable>
          </View>

          <Animated.View style={[styles.center, { opacity: slideAnim, transform: [{ translateX: slideTranslate }] }]}>
            <View style={[styles.iconWrap, { backgroundColor: s.tint + "1A" }]}>
              <Ionicons name={s.icon} size={56} color={s.tint} />
            </View>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.text}>{s.text}</Text>

            <View style={styles.dots}>
              {SLIDES.map((_, i) => (
                <Dot key={i} active={i === step} />
              ))}
            </View>
          </Animated.View>

          <View style={styles.footer}>
            <Button title={step < LAST ? "Suivant" : "Commencer"} onPress={() => setStep(step + 1)} />
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
  iconWrap: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  iconWrapSmall: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: spacing.sm },
  title: { ...typography.h1, fontSize: 24, textAlign: "center" },
  text: { ...typography.body, color: colors.textMuted, textAlign: "center", lineHeight: 22 },
  dots: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.lg },
  dot: { height: 8, borderRadius: 4 },
  footer: { gap: spacing.sm, paddingBottom: spacing.lg },
  formContent: { flexGrow: 1, justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  later: { alignItems: "center", paddingVertical: spacing.sm },
  laterText: { ...typography.body, color: colors.primary, fontWeight: "700" },
});
