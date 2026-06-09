import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useAuth } from "@/providers/AuthProvider";
import { colors, spacing, typography } from "@/theme";

export default function Home() {
  const { profile, signOut } = useAuth();
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={typography.h1}>Espace Admin</Text>
          <Text style={typography.caption}>
            {profile?.full_name ? `Connecté : ${profile.full_name}` : "Espace Espace Admin"}
          </Text>
        </View>

        <Card style={styles.card}>
          <Text style={typography.h3}>Socle prêt ✅</Text>
          <Text style={[typography.body, styles.muted]}>
            Le module Administrateur (dashboard, gestion, signalements, paramètres, stats) sera ajouté ultérieurement.
          </Text>
        </Card>

        <Button title="Se déconnecter" variant="outline" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.lg },
  header: { gap: spacing.xs },
  card: { gap: spacing.sm },
  muted: { color: colors.textMuted },
});
