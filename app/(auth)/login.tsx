import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { isValidEmail } from "@/lib/validation";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { colors, radius, spacing, typography } from "@/theme";

// Message d'échec de connexion GÉNÉRIQUE : ne révèle jamais si l'e-mail existe
// (anti-énumération de comptes, OWASP). Seul le cas « compte suspendu » a un
// message dédié, car il n'aide pas à énumérer (il faut déjà les bons identifiants).
const GENERIC_LOGIN_ERROR = "E-mail ou mot de passe incorrect.";
const SUSPENDED_MESSAGE = "Votre compte a été suspendu. Contactez l'administrateur.";

const logo = require("../../assets/logo/hygiena-icon-drop.png");

// Garde-fou anti-spam CÔTÉ UI (le vrai rate-limit reste serveur, côté Supabase) :
// après MAX_ATTEMPTS échecs, on verrouille le bouton pendant COOLDOWN_MS.
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;
const KEY_FAILS = "login_fail_count";
const KEY_LOCK = "login_locked_until";

export default function Login() {
  const { signIn } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const passwordRef = useRef<TextInput>(null);

  // Restaure le compteur/verrou persistés (survit à un redémarrage de l'app).
  useEffect(() => {
    (async () => {
      const [f, l] = await Promise.all([AsyncStorage.getItem(KEY_FAILS), AsyncStorage.getItem(KEY_LOCK)]);
      if (f) setFailCount(Number(f) || 0);
      if (l) setLockedUntil(Number(l) || 0);
    })();
  }, []);

  const locked = lockedUntil > nowTs;
  const remaining = locked ? Math.ceil((lockedUntil - nowTs) / 1000) : 0;

  // Décompte tant que le verrou est actif (re-active le bouton à expiration).
  useEffect(() => {
    if (!locked) return;
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [locked]);

  const canSubmit = isValidEmail(email) && password.length > 0 && !locked;

  async function handleLogin() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      hapticSuccess();
      // Succès : on remet le compteur à zéro.
      setFailCount(0);
      setLockedUntil(0);
      AsyncStorage.multiRemove([KEY_FAILS, KEY_LOCK]).catch(() => {});
    } catch (e) {
      hapticError();
      const next = failCount + 1;
      setFailCount(next);
      AsyncStorage.setItem(KEY_FAILS, String(next)).catch(() => {});
      if (next >= MAX_ATTEMPTS) {
        const until = Date.now() + COOLDOWN_MS;
        setLockedUntil(until);
        setNowTs(Date.now());
        AsyncStorage.setItem(KEY_LOCK, String(until)).catch(() => {});
      }
      // Anti-énumération : message générique, sauf compte explicitement suspendu.
      const raw = e instanceof Error ? e.message : "";
      toast.error(raw === SUSPENDED_MESSAGE ? SUSPENDED_MESSAGE : GENERIC_LOGIN_ERROR);
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
        <Text style={styles.tagline}>Prends soin de toi, jour après jour 🌿</Text>
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

        {locked ? (
          <View style={styles.lockNote}>
            <Ionicons name="time-outline" size={15} color={colors.danger} />
            <Text style={styles.lockText}>Trop de tentatives. Réessaie dans {remaining}s.</Text>
          </View>
        ) : null}

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
  lockNote: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.primaryLight, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.xs },
  lockText: { ...typography.caption, color: colors.danger, fontWeight: "600", flex: 1 },
  footer: { marginTop: spacing.xl, gap: spacing.md, alignItems: "center" },
  link: { ...typography.body, color: colors.textMuted },
  linkStrong: { color: colors.primary, fontWeight: "700" },
});
