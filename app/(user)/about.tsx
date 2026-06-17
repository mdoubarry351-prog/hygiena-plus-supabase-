import { Share, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { MenuRow } from "@/components/MenuRow";
import { FadeInView } from "@/components/FadeInView";
import { APP_DOWNLOAD_URL } from "@/lib/app-config";
import { spacing } from "@/theme";

// Regroupe l'aide et les infos légales (écrans cibles existants, inchangés) +
// « Inviter un ami » (logique conservée : Share du lien de téléchargement).
export default function AboutScreen() {
  const router = useRouter();

  async function inviteFriend() {
    try {
      await Share.share({
        message: `Découvre Hygiena+, l'app de santé féminine 🌸. Télécharge-la ici : ${APP_DOWNLOAD_URL}`,
      });
    } catch {
      // partage annulé : rien à faire
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Aide & à propos" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <FadeInView fill={false} delay={0} style={styles.group}>
          <MenuRow icon="help-circle-outline" title="Aide & FAQ" sub="Questions fréquentes, nous contacter" onPress={() => router.push("/(user)/help")} />
          <MenuRow icon="shield-checkmark-outline" title="Politique de confidentialité" sub="Tes données et tes droits" onPress={() => router.push("/(user)/privacy")} />
          <MenuRow icon="document-text-outline" title="Conditions d'utilisation" sub="Règles d'usage de l'application" onPress={() => router.push("/(user)/terms")} />
          <MenuRow icon="share-social-outline" title="Inviter un ami" sub="Partage le lien de téléchargement de l'app" onPress={inviteFriend} />
        </FadeInView>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  group: { gap: spacing.md },
});
