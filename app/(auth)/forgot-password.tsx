import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { AuthLogo } from "@/components/AuthLogo";
import { FadeInView } from "@/components/FadeInView";
import { authService } from "@/lib/auth-service";
import { isValidEmail } from "@/lib/validation";
import { hapticSuccess } from "@/lib/haptics";
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
    } catch {
      // Anti-énumération : on n'expose JAMAIS l'échec (ex. e-mail inexistant).
      // On affiche toujours la même confirmation neutre, qu'un compte existe ou non.
    } finally {
      hapticSuccess();
      setSent(true);
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
            <Text style={styles.successTitle}>Vérifie ta boîte mail</Text>
            <Text style={styles.successText}>
              Si un compte est associé à {email.trim()}, un lien de réinitialisation vient d'être envoyé. Ouvre-le sur cet appareil pour choisir un nouveau mot de passe.
            </Text>
            <Button title="Retour à la connexion" onPress={() => router.replace("/(auth)/login")} />
          </View>
        </FadeInView>
      </Screen>
    );
  }

  return (
    <Screen keyboardAware>
      <View style={styles.header}>
        <AuthLogo />
        <Text style={[typography.h2, styles.centerText]}>Mot de passe oublié</Text>
        <Text style={[typography.caption, styles.centerText]}>Nous t'enverrons un lien de réinitialisation.</Text>
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
  header: { alignItems: "center", marginTop: spacing.xl, marginBottom: spacing.xl, gap: spacing.xs },
  centerText: { textAlign: "center" },
  wordmark: { fontSize: 26, fontWeight: "700", color: colors.primaryDark, letterSpacing: 0.3, marginBottom: spacing.xs },
  plus: { color: colors.accent, fontWeight: "700" },
  footer: { marginTop: spacing.lg, alignItems: "center" },
  link: { color: colors.primary, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingHorizontal: spacing.lg },
  badge: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  successTitle: { ...typography.h2, textAlign: "center" },
  successText: { ...typography.body, color: colors.textMuted, textAlign: "center", paddingHorizontal: spacing.md },
});
