import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useAuth } from "@/providers/AuthProvider";
import { colors, spacing, typography } from "@/theme";

export default function Register() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Nom requis", "Indiquez votre prénom et votre nom.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Mot de passe trop court", "Minimum 6 caractères.");
      return;
    }
    setLoading(true);
    try {
      const { needsEmailConfirmation } = await signUp(email.trim(), password, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      if (needsEmailConfirmation) {
        Alert.alert(
          "Compte créé",
          "Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.",
          [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
        );
      }
      // Sinon, la session est active : l'aiguilleur racine redirige automatiquement.
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      Alert.alert("Inscription échouée", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.logo}>Créer un compte</Text>
        <Text style={typography.caption}>Rejoignez Hygiena+</Text>
      </View>

      <Input label="Prénom" value={firstName} onChangeText={setFirstName} placeholder="Awa" autoCapitalize="words" />
      <Input label="Nom" value={lastName} onChangeText={setLastName} placeholder="Diop" autoCapitalize="words" />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="vous@exemple.com"
      />
      <Input
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Au moins 6 caractères"
      />

      <Button title="S'inscrire" onPress={handleRegister} loading={loading} />

      <View style={styles.footer}>
        <Link href="/(auth)/login" style={styles.link}>
          J'ai déjà un compte
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginTop: spacing.xxl, marginBottom: spacing.xl },
  logo: { ...typography.h1, color: colors.primary },
  footer: { marginTop: spacing.lg, alignItems: "center" },
  link: { color: colors.primary, fontWeight: "600" },
});
