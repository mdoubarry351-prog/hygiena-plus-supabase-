import { useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { PhoneInput } from "@/components/PhoneInput";
import { Button } from "@/components/Button";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { onlyDigits, toE164 } from "@/lib/phone";
import { isValidEmail, passwordStrength, passwordIssue, PASSWORD_MIN_LENGTH } from "@/lib/validation";
import { LEGAL_VERSION } from "@/lib/legal";
import { PENDING_CONSENT_KEY } from "@/lib/legal-service";
import { hapticLight, hapticSuccess, hapticError } from "@/lib/haptics";
import { colors, radius, spacing, typography } from "@/theme";

const STRENGTH_COLORS = [colors.border, colors.danger, colors.accent, colors.success];

// Version blanche de la Goutte-cœur : le hero est violet, la marque violette
// n'y contrasterait pas.
const logo = require("../../assets/logo/hygiena-icon-drop-white.png");

// Pastilles de la preuve sociale (initiales décoratives, teintes de la palette).
const PROOF_AVATARS = [
  { letter: "A", bg: colors.accent },
  { letter: "F", bg: colors.danger },
  { letter: "M", bg: colors.secondary },
];

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
      // Consentement explicite (case cochée) : on mémorise la version acceptée.
      // Elle sera enregistrée côté serveur dès qu'une session est active
      // (immédiate, ou après confirmation e-mail). Cf. AuthProvider.
      await AsyncStorage.setItem(PENDING_CONSENT_KEY, LEGAL_VERSION);
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
    <Screen keyboardAware padded={false}>
      {/* ---- Hero « Jardin » : promesse + preuve sociale sur fond violet ---- */}
      <View style={styles.hero}>
        {/* Pétales décoratifs (cercles translucides) */}
        <View style={[styles.petal, styles.petalBig]} />
        <View style={[styles.petal, styles.petalSmall]} />

        <Text style={styles.wordmark}>Hygiena<Text style={styles.plus}>+</Text></Text>
        <View style={styles.drop}>
          <Image source={logo} style={styles.dropImg} resizeMode="contain" />
        </View>
        <Text style={styles.heroTitle}>Ton espace santé,{"\n"}rien qu'à toi.</Text>
        <Text style={styles.heroSub}>Cycle, médecins vérifiées, communauté bienveillante.</Text>

        <View style={styles.proofRow}>
          <View style={styles.proofAvatars}>
            {PROOF_AVATARS.map((a, i) => (
              <View key={a.letter} style={[styles.proofAvatar, { backgroundColor: a.bg }, i > 0 && styles.proofAvatarOverlap]}>
                <Text style={styles.proofAvatarText}>{a.letter}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.proofText}>Rejoins des milliers de femmes en Guinée</Text>
        </View>
      </View>

      {/* ---- Feuille blanche : le formulaire, groupé et raccourci ---- */}
      <View style={styles.sheet}>
        <View style={styles.groupTitle}>
          <Ionicons name="person-outline" size={13} color={colors.textMuted} />
          <Text style={styles.groupTitleText}>Ton identité</Text>
        </View>

        {/* Prénom + Nom sur une seule ligne (écran plus court, même contenu). */}
        <View style={styles.nameRow}>
          <View style={styles.nameCol}>
            <Input
              label="Prénom"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Awa"
              autoCapitalize="words"
              textContentType="givenName"
              returnKeyType="next"
              onSubmitEditing={() => lastRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>
          <View style={styles.nameCol}>
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
          </View>
        </View>
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

        <View style={styles.groupTitle}>
          <Ionicons name="lock-closed-outline" size={13} color={colors.textMuted} />
          <Text style={styles.groupTitleText}>Ta sécurité</Text>
        </View>

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
            J'accepte les <Link href="/legal/terms" style={styles.termsLink}>conditions d'utilisation</Link> et la <Link href="/legal/privacy" style={styles.termsLink}>politique de confidentialité</Link>.
          </Text>
        </Pressable>

        <Button title="Créer mon compte" onPress={handleRegister} loading={loading} disabled={!formValid} />

        <View style={styles.footer}>
          <Link href="/(auth)/login" style={styles.link}>
            J'ai déjà un compte
          </Link>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // ---- Hero violet ----
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl + spacing.lg, // espace recouvert par la feuille
    overflow: "hidden",
  },
  petal: { position: "absolute", borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.10)" },
  petalBig: { width: 150, height: 150, right: -40, top: -40 },
  petalSmall: { width: 80, height: 80, right: 70, bottom: 20 },
  wordmark: { fontSize: 17, fontWeight: "800", color: colors.white, letterSpacing: 0.3, marginBottom: spacing.md, fontFamily: typography.h3.fontFamily },
  plus: { color: colors.accent, fontWeight: "800" },
  drop: {
    width: 56, height: 56, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  dropImg: { width: 36, height: 36 },
  heroTitle: { ...typography.h2, fontSize: 24, lineHeight: 30, color: colors.white },
  heroSub: { ...typography.caption, fontSize: 13.5, color: colors.white, opacity: 0.92, marginTop: spacing.xs },
  proofRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  proofAvatars: { flexDirection: "row" },
  proofAvatar: {
    width: 26, height: 26, borderRadius: radius.pill, borderWidth: 2, borderColor: "rgba(255,255,255,0.85)",
    alignItems: "center", justifyContent: "center",
  },
  proofAvatarOverlap: { marginLeft: -8 },
  proofAvatarText: { fontSize: 10, fontWeight: "800", color: colors.white, fontFamily: typography.caption.fontFamily },
  proofText: { ...typography.caption, fontSize: 12, color: colors.white, opacity: 0.95, fontWeight: "700", flex: 1 },
  // ---- Feuille blanche qui recouvre le hero ----
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    marginTop: -spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  groupTitle: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  groupTitleText: {
    ...typography.caption, fontSize: 11, color: colors.textMuted, fontWeight: "800",
    textTransform: "uppercase", letterSpacing: 0.6,
  },
  nameRow: { flexDirection: "row", gap: spacing.sm },
  nameCol: { flex: 1 },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: -spacing.xs, marginBottom: spacing.sm },
  strengthBars: { flexDirection: "row", gap: spacing.xs, flex: 1 },
  strengthBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.border },
  strengthLabel: { ...typography.caption, fontWeight: "700", width: 52, textAlign: "right" },
  terms: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginBottom: spacing.md },
  termsPressed: { opacity: 0.6 },
  termsText: { ...typography.caption, color: colors.textMuted, flex: 1, lineHeight: 18 },
  termsLink: { color: colors.primary, fontWeight: "700" },
  footer: { marginTop: spacing.lg, alignItems: "center", paddingBottom: spacing.lg },
  link: { color: colors.primary, fontWeight: "600" },
});
