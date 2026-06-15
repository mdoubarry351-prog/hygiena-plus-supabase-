import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { FadeInView } from "@/components/FadeInView";
import { authService } from "@/lib/auth-service";
import { isValidEmail } from "@/lib/validation";
import { colors, spacing, typography } from "@/theme";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!isValidEmail(email)) return;
    setLoading(true);
    try {
      await authService.resetPassword(email.trim(), "hygienaplus://reset-password");
      setSent(true);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  // Écran de confirmation après envoi.
  if (sent) {
    return (
      <Screen>
        <FadeInView>
          <View style={styles.center}>
            <View style={styles.badge}>
              <Ionicons name="mail-open-outline" size={34} color={colors.primaryDark} />
            </View>
            <Text style={styles.successTitle}>E-mail envoyé</Text>
            <Text style={styles.successText}>
              Un lien de réinitialisation a été envoyé à {email.trim()}. Ouvrez-le sur cet appareil pour choisir un nouveau mot de passe.
            </Text>
            <Button title="Retour à la connexion" onPress={() => router.replace("/(auth)/login")} />
          </View>
        </FadeInView>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.h2}>Mot de passe oublié</Text>
        <Text style={typography.caption}>Nous vous enverrons un lien de réinitialisation.</Text>
      </View>

      <Input
        label="Email"
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        placeholder="vous@exemple.com"
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleReset}
        validate={(v) => (v.length > 0 && !isValidEmail(v) ? "Adresse email invalide." : null)}
      />

      <Button title="Envoyer le lien" onPress={handleReset} loading={loading} disabled={!isValidEmail(email)} />

      <View style={styles.footer}>
        <Link href="/(auth)/login" style={styles.link}>
          Retour à la connexion
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.xxl, marginBottom: spacing.xl, gap: spacing.xs },
  footer: { marginTop: spacing.lg, alignItems: "center" },
  link: { color: colors.primary, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingHorizontal: spacing.lg },
  badge: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  successTitle: { ...typography.h2, textAlign: "center" },
  successText: { ...typography.body, color: colors.textMuted, textAlign: "center", paddingHorizontal: spacing.md },
});
