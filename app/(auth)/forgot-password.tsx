import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { authService } from "@/lib/auth-service";
import { colors, spacing, typography } from "@/theme";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!email.trim()) {
      Alert.alert("Email requis", "Indiquez votre adresse email.");
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(email.trim(), "hygienaplus://reset-password");
      Alert.alert("Email envoyé", "Consultez votre boîte de réception pour réinitialiser votre mot de passe.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      Alert.alert("Erreur", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.h2}>Mot de passe oublié</Text>
        <Text style={typography.caption}>Nous vous enverrons un lien de réinitialisation.</Text>
      </View>

      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="vous@exemple.com"
      />

      <Button title="Envoyer le lien" onPress={handleReset} loading={loading} />

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
});
