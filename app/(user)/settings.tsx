import { ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { MenuRow } from "@/components/MenuRow";
import { FadeInView } from "@/components/FadeInView";
import { spacing } from "@/theme";

const STEP = 55;

// Regroupe les réglages du compte (les écrans cibles existent déjà, inchangés).
export default function SettingsScreen() {
  const router = useRouter();
  return (
    <Screen>
      <ScreenHeader title="Réglages" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <FadeInView fill={false} delay={0} style={styles.group}>
          <MenuRow icon="notifications-outline" title="Préférences de notifications" sub="Choisir les notifications à recevoir" onPress={() => router.push("/(user)/notification-settings")} />
          <MenuRow icon="lock-closed-outline" title="Verrouillage & confidentialité" sub="Code PIN, biométrie" onPress={() => router.push("/(user)/lock")} />
          <MenuRow icon="person-remove-outline" title="Comptes bloqués" sub="Gérer les personnes bloquées" onPress={() => router.push("/(user)/blocked")} />
        </FadeInView>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  group: { gap: spacing.md },
});
