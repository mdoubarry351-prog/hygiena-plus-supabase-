import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useAuth } from "@/providers/AuthProvider";
import { colors, spacing, typography } from "@/theme";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert("Champs requis", "Renseignez votre email et votre mot de passe.");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      // Redirection gérée par l'aiguilleur racine via onAuthStateChange.
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      Alert.alert("Connexion échouée", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.logo}>Hygiena+</Text>
        <Text style={typography.caption}>Votre santé, en confiance.</Text>
      </View>

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
        placeholder="••••••••"
      />

      <Button title="Se connecter" onPress={handleLogin} loading={loading} />

      <View style={styles.footer}>
        <Link href="/(auth)/forgot-password" style={styles.link}>
          Mot de passe oublié ?
        </Link>
        <Link href="/(auth)/register" style={styles.link}>
          Créer un compte
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginTop: spacing.xxl, marginBottom: spacing.xl },
  logo: { ...typography.h1, color: colors.primary, fontSize: 34 },
  footer: { marginTop: spacing.lg, gap: spacing.md, alignItems: "center" },
  link: { color: colors.primary, fontWeight: "600" },
});
