import { useRef, useState } from "react";
import { Alert, Image, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useAuth } from "@/providers/AuthProvider";
import { isValidEmail } from "@/lib/validation";
import { colors, spacing, typography } from "@/theme";

const logo = require("../../assets/logo/hygiena-icon-1024.png");

export default function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const canSubmit = isValidEmail(email) && password.length > 0;

  async function handleLogin() {
    if (!canSubmit) return;
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
    <Screen keyboardAware>
      {/* Halo mint doux derrière l'en-tête (décoratif, non interactif) */}
      <View style={styles.glow} pointerEvents="none" />

      <View style={styles.header}>
        <View style={styles.logoHalo}>
          <Image source={logo} style={styles.logoImg} resizeMode="contain" />
        </View>
        <Text style={styles.wordmark}>
          Hygiena<Text style={styles.plus}>+</Text>
        </Text>
        <Text style={styles.tagline}>Prenez soin de vous, jour après jour 🌿</Text>
      </View>

      <View style={styles.form}>
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
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          blurOnSubmit={false}
          validate={(v) => (v.length > 0 && !isValidEmail(v) ? "Adresse email invalide." : null)}
        />
        <Input
          ref={passwordRef}
          label="Mot de passe"
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          secureToggle
          autoComplete="password"
          textContentType="password"
          placeholder="••••••••"
          returnKeyType="done"
          onSubmitEditing={handleLogin}
        />

        <Button title="Se connecter" onPress={handleLogin} loading={loading} disabled={!canSubmit} />
        <Button title="Se connecter par téléphone" variant="outline" onPress={() => router.push("/(auth)/phone")} />
      </View>

      <View style={styles.footer}>
        <Link href="/(auth)/forgot-password" style={styles.link}>
          Mot de passe oublié ?
        </Link>
        <Link href="/(auth)/register" style={styles.link}>
          Pas encore de compte ? <Text style={styles.linkStrong}>Créer un compte</Text>
        </Link>
      </View>
    </Screen>
  );
}

const HALO = 124;
const styles = StyleSheet.create({
  glow: {
    position: "absolute", top: -150, left: -60, right: -60, height: 320,
    borderRadius: 200, backgroundColor: colors.primaryLight, opacity: 0.5,
  },
  header: { alignItems: "center", marginTop: spacing.xxl, marginBottom: spacing.xl, gap: spacing.sm },
  logoHalo: {
    width: HALO, height: HALO, borderRadius: HALO / 2, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.primaryDark, shadowOpacity: 0.15, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 4,
  },
  logoImg: { width: 78, height: 78 },
  wordmark: { fontSize: 32, fontWeight: "700", color: colors.primaryDark, marginTop: spacing.sm, letterSpacing: 0.3 },
  plus: { color: colors.accent, fontWeight: "700" },
  tagline: { ...typography.body, color: colors.textMuted, textAlign: "center" },
  form: { gap: spacing.xs },
  footer: { marginTop: spacing.xl, gap: spacing.md, alignItems: "center" },
  link: { ...typography.body, color: colors.textMuted },
  linkStrong: { color: colors.primary, fontWeight: "700" },
});
