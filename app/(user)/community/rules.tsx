import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CommunityRules } from "@/components/CommunityRules";
import { spacing, typography } from "@/theme";

export default function CommunityRulesScreen() {
  return (
    <Screen>
      <ScreenHeader title="Règles de la communauté" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          La communauté Hygiena+ est un espace d'entraide bienveillant. Merci de respecter ces
          quelques règles pour que chacune s'y sente en sécurité.
        </Text>
        <View style={styles.block}>
          <CommunityRules />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  intro: { ...typography.body, lineHeight: 22 },
  block: { gap: spacing.md },
});
