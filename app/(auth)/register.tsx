import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { PhoneInput } from "@/components/PhoneInput";
import { Button } from "@/components/Button";
import { AuthLogo } from "@/components/AuthLogo";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { onlyDigits, toE164 } from "@/lib/phone";
import { isValidEmail, passwordStrength, passwordIssue, PASSWORD_MIN_LENGTH } from "@/lib/validation";
import { hapticLight, hapticSuccess, hapticError } from "@/lib/haptics";
import { colors, spacing, typography } from "@/theme";

const STRENGTH_COLORS = [colors.border, colors.danger, colors.accent, colors.success];

export default function Register() {
  const { signUp } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const lastRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const strength = passwordStrength(password);
  const passwordsMatch = confirm.length === 0 || confirm === password;
  const formValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    isValidEmail(email) &&
    password.length >= PASSWORD_MIN_LENGTH &&
    confirm === password &&
    accepted;

  async function handleRegister() {
    if (!formValid) return;
    setLoading(true);
    try {
      const localPhone = onlyDigits(phone);
      const { needsEmailConfirmation } = await signUp(email.trim(), password, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: localPhone ? toE164(localPhone) : undefined, // E.164 « +224… »
      });
      hapticSuccess();
      if (needsEmailConfirmation) {
        toast.success("Compte créé — vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.");
        router.replace("/(auth)/login");
      }
      // Sinon, la session est active : l'aiguilleur racine redirige automatiquement.
    } catch (e) {
      hapticError();
      // Anti-énumération : message générique. On ne révèle pas si l'e-mail est
      // déjà enregistré (Supabase obfusque déjà côté serveur si la confirmation
      // e-mail est active). Les vraies erreurs réseau restent génériques.
      const raw = e instanceof Error ? e.message.toLowerCase() : "";
      if (raw.includes("already") || raw.includes("registered") || raw.includes("exists")) {
        toast.success("Compte créé — vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.");
        router.replace("/(auth)/login");
      } else {
        toast.error("Inscription impossible pour le moment. Réessaie.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen keyboardAware>
      <View style={styles.header}>
        <AuthLogo />
        <Text style={styles.wordmark}>Hygiena<Text style={styles.plus}>+</Text></Text>
        <Text style={styles.logo}>Créer un compte</Text>
        <Text style={typography.caption}>Rejoins la communauté</Text>
      </View>

      <Input
        label="Prénom"
        value={firstName}
        onChangeText={setFirstName}
        placeholder="Awa"
        autoCapitalize="words"
        textContentType="givenName"
        autoFocus
        returnKeyType="next"
        onSubmitEditing={() => lastRef.current?.focus()}
        blurOnSubmit={false}
      />
      <Input
        ref={lastRef}
        label="Nom"
        value={lastName}
        onChangeText={setLastName}
        placeholder="Diop"
        autoCapitalize="words"
        textContentType="familyName"
        returnKeyType="next"
        onSubmitEditing={() => phoneRef.current?.focus()}
        blurOnSubmit={false}
      />
      <PhoneInput
        ref={phoneRef}
        label="Téléphone"
        value={phone}
        onChangeText={(f) => setPhone(f)}
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        blurOnSubmit={false}
      />
      <Input
        ref={emailRef}
        label="Email"
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        placeholder="vous@exemple.com"
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
        textContentType="newPassword"
        placeholder={`Au moins ${PASSWORD_MIN_LENGTH} caractères`}
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        blurOnSubmit={false}
        validate={(v) => (v.length > 0 ? passwordIssue(v) : null)}
      />

      {/* Jauge de force du mot de passe */}
      {password.length > 0 ? (
        <View style={styles.strengthRow}>
          <View style={styles.strengthBars}>
            {[1, 2, 3].map((n) => (
              <View key={n} style={[styles.strengthBar, strength.score >= n ? { backgroundColor: STRENGTH_COLORS[strength.score] } : null]} />
            ))}
          </View>
          <Text style={[styles.strengthLabel, { color: STRENGTH_COLORS[strength.score] }]}>{strength.label}</Text>
        </View>
      ) : null}

      <Input
        ref={confirmRef}
        label="Confirmer le mot de passe"
        icon="lock-closed-outline"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        secureToggle
        textContentType="newPassword"
        placeholder="Retapez le mot de passe"
        returnKeyType="done"
        onSubmitEditing={handleRegister}
        validate={() => (!passwordsMatch ? "Les mots de passe ne correspondent pas." : null)}
      />

      {/* Acceptation des conditions */}
      <Pressable onPress={() => { hapticLight(); setAccepted((a) => !a); }} style={({ pressed }) => [styles.terms, pressed && styles.termsPressed]} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }}>
        <Ionicons name={accepted ? "checkbox" : "square-outline"} size={22} color={accepted ? colors.primary : colors.textMuted} />
        <Text style={styles.termsText}>
          J'accepte les <Link href="/(user)/terms" style={styles.termsLink}>conditions d'utilisation</Link> et la <Link href="/(user)/privacy" style={styles.termsLink}>politique de confidentialité</Link>.
        </Text>
      </Pressable>

      <Button title="S'inscrire" onPress={handleRegister} loading={loading} disabled={!formValid} />

      <View style={styles.footer}>
        <Link href="/(auth)/login" style={styles.link}>
          J'ai déjà un compte
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginTop: spacing.lg, marginBottom: spacing.lg, gap: spacing.xs },
  wordmark: { fontSize: 26, fontWeight: "700", color: colors.primaryDark, letterSpacing: 0.3 },
  plus: { color: colors.accent, fontWeight: "700" },
  logo: { ...typography.h2, color: colors.text },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: -spacing.xs, marginBottom: spacing.sm },
  strengthBars: { flexDirection: "row", gap: spacing.xs, flex: 1 },
  strengthBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.border },
  strengthLabel: { ...typography.caption, fontWeight: "700", width: 52, textAlign: "right" },
  terms: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginBottom: spacing.md },
  termsPressed: { opacity: 0.6 },
  termsText: { ...typography.caption, color: colors.textMuted, flex: 1, lineHeight: 18 },
  termsLink: { color: colors.primary, fontWeight: "700" },
  footer: { marginTop: spacing.lg, alignItems: "center" },
  link: { color: colors.primary, fontWeight: "600" },
});
