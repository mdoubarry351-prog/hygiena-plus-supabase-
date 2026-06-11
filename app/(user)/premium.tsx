import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/providers/AuthProvider";
import { useAppSettings } from "@/hooks/useAppSettings";
import { authService } from "@/lib/auth-service";
import { colors, fonts, radius, spacing, typography } from "@/theme";

const BENEFITS: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[] = [
  { icon: "chatbubbles-outline", title: "Messagerie illimitée", sub: "Échangez des conseils avec les médecins vérifiées." },
  { icon: "shield-checkmark-outline", title: "Suivi prioritaire", sub: "Vos prédictions et rappels mis en avant." },
  { icon: "heart-outline", title: "Soutien bien-être", sub: "Plus de contenus et d'accompagnement." },
];

export default function Premium() {
  const { profile, session, refreshProfile } = useAuth();
  const { premium_enabled } = useAppSettings();
  const [saving, setSaving] = useState(false);
  const isPremium = !!profile?.is_premium;

  async function setPremium(next: boolean) {
    if (!session?.user) return;
    setSaving(true);
    try {
      await authService.updateProfile(session.user.id, { is_premium: next });
      await refreshProfile();
      Alert.alert(
        next ? "Bienvenue en Premium 🌿" : "Premium désactivé",
        next ? "Vous pouvez maintenant écrire aux médecins." : "Votre abonnement a été désactivé."
      );
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Action échouée");
    } finally {
      setSaving(false);
    }
  }

  // Module désactivé par l'admin : premium indisponible.
  if (!premium_enabled) {
    return (
      <Screen>
        <ScreenHeader />
        <EmptyState icon="sparkles-outline" title="Service non disponible pour le moment" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.crown}>
            <Ionicons name="star" size={34} color={colors.white} />
          </View>
          <Text style={styles.title}>Hygiena+ Premium</Text>
          <Text style={styles.sub}>
            {isPremium ? "Votre abonnement est actif." : "Débloquez la messagerie avec les médecins."}
          </Text>
          {isPremium ? (
            <View style={styles.activePill}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primaryDark} />
              <Text style={styles.activeText}>Abonnement actif</Text>
            </View>
          ) : null}
        </View>

        {BENEFITS.map((b) => (
          <Card key={b.title} style={styles.benefit}>
            <View style={styles.benefitIcon}>
              <Ionicons name={b.icon} size={22} color={colors.primary} />
            </View>
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>{b.title}</Text>
              <Text style={styles.benefitSub}>{b.sub}</Text>
            </View>
          </Card>
        ))}

        <Text style={styles.note}>Paiement simulé — démonstration, aucun débit réel.</Text>

        {isPremium ? (
          <Button title="Se désabonner" variant="outline" onPress={() => setPremium(false)} loading={saving} />
        ) : (
          <Button title="S'abonner (simulé)" onPress={() => setPremium(true)} loading={saving} />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  back: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -spacing.xs },
  backText: { ...typography.body, color: colors.text },
  hero: { alignItems: "center", gap: spacing.xs, marginVertical: spacing.sm },
  crown: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.primaryDark, shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  title: { ...typography.h2, marginTop: spacing.sm },
  sub: { ...typography.body, color: colors.textMuted, textAlign: "center" },
  activePill: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.primaryLight, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, marginTop: spacing.xs },
  activeText: { ...typography.caption, color: colors.primaryDark, fontFamily: fonts.bodySemiBold },
  benefit: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  benefitIcon: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  benefitText: { flex: 1, gap: 2 },
  benefitTitle: { ...typography.name },
  benefitSub: { ...typography.caption, color: colors.textMuted },
  note: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
});
