import { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { TrustRow } from "@/components/TrustRow";
import { FadeInView } from "@/components/FadeInView";
import { PressableScale } from "@/components/PressableScale";
import { useAuth } from "@/providers/AuthProvider";
import { useAppSettings } from "@/hooks/useAppSettings";
import { PRACTITIONER_TYPES, PRACTITIONER_LABELS } from "@/lib/practitioner";
import { colors, radius, spacing, typography } from "@/theme";

const STEP = 60;

// Hub des consultations : présente les spécialités disponibles. Chaque carte ouvre
// la liste des praticiens filtrée par type. Extensible (ajouter une entrée dans
// PRACTITIONER_TYPES suffit). Réutilise entièrement le flux de réservation existant.
export default function ConsultationsHub() {
  const { role } = useAuth();
  const { doctors_enabled } = useAppSettings();
  const router = useRouter();

  const goMine = useCallback(() => router.push("/(user)/appointments/mine"), [router]);

  if (role === "doctor") return <Redirect href="/(user)" />;

  if (!doctors_enabled) {
    return (
      <Screen>
        <ScreenHeader title="Consultations" />
        <EmptyState icon="medkit-outline" title="Service non disponible pour le moment" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title="Consultations"
        right={
          <PressableScale onPress={goMine} haptic hitSlop={10} scaleTo={0.86} style={styles.iconBtn} accessibilityLabel="Mes rendez-vous">
            <Ionicons name="calendar-outline" size={25} color={colors.text} />
          </PressableScale>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <FadeInView fill={false} delay={0}>
          <Text style={styles.intro}>Choisis le type d'accompagnement dont tu as besoin.</Text>
        </FadeInView>

        {PRACTITIONER_TYPES.map((t, i) => {
          const L = PRACTITIONER_LABELS[t];
          return (
            <FadeInView key={t} fill={false} delay={(i + 1) * STEP}>
              <Card
                onPress={() => router.push({ pathname: "/(user)/appointments", params: { type: t } })}
                haptic
                accessibilityLabel={L.title}
                style={styles.specCard}
              >
                <View style={styles.specIcon}><Text style={styles.specEmoji}>{L.emoji}</Text></View>
                <View style={styles.specText}>
                  <Text style={styles.specTitle}>{L.title}</Text>
                  <Text style={styles.specSub}>{L.hubSubtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Card>
            </FadeInView>
          );
        })}

        <FadeInView fill={false} delay={(PRACTITIONER_TYPES.length + 1) * STEP}>
          <View style={styles.trust}>
            <TrustRow signals={["verified", "confidential"]} />
          </View>
        </FadeInView>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconBtn: { padding: spacing.xs },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  intro: { ...typography.body, color: colors.textMuted },
  specCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  specIcon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  specEmoji: { fontSize: 26 },
  specText: { flex: 1, gap: 2 },
  specTitle: { ...typography.name, color: colors.text },
  specSub: { ...typography.caption, color: colors.textMuted, lineHeight: 17 },
  trust: { marginTop: spacing.sm },
});
