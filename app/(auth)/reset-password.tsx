import { useEffect, useRef, useState } from "react";
import { Alert, Linking, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";
import { FadeInView } from "@/components/FadeInView";
import { supabase } from "@/lib/supabase";
import { authService } from "@/lib/auth-service";
import { passwordStrength } from "@/lib/validation";
import { hapticSuccess } from "@/lib/haptics";
import { colors, spacing, typography } from "@/theme";

const STRENGTH_COLORS = [colors.border, colors.danger, colors.accent, colors.success];

type Status = "checking" | "ready" | "invalid";

// Extrait les paramètres d'auth d'une URL (query ?… ET fragment #…).
function parseAuthParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const collect = (s?: string) => {
    if (!s) return;
    for (const part of s.split("&")) {
      const [k, v] = part.split("=");
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
    }
  };
  collect(url.split("#")[1]);
  collect(url.split("?")[1]?.split("#")[0]);
  return out;
}

export default function ResetPassword() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const confirmRef = useRef<TextInput>(null);

  // Établit la session de récupération à partir du lien reçu par e-mail
  // (flux PKCE `?code=` OU implicite `#access_token=…&refresh_token=…`).
  useEffect(() => {
    let alive = true;

    async function processUrl(url: string | null) {
      if (!url) return;
      const p = parseAuthParams(url);
      try {
        if (p.code) {
          await supabase.auth.exchangeCodeForSession(p.code);
        } else if (p.access_token && p.refresh_token) {
          await supabase.auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token });
        }
      } catch {
        // jeton invalide / expiré → on restera en "invalid"
      }
    }

    (async () => {
      await processUrl(await Linking.getInitialURL());
      const { data } = await supabase.auth.getSession();
      if (alive) setStatus(data.session ? "ready" : "invalid");
    })();

    // App déjà ouverte : capture le deep link entrant.
    const sub = Linking.addEventListener("url", async ({ url }) => {
      await processUrl(url);
      const { data } = await supabase.auth.getSession();
      if (alive && data.session) setStatus("ready");
    });

    // Événement Supabase de récupération de mot de passe.
    const { data: authSub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (alive && (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && sess))) setStatus("ready");
    });

    return () => { alive = false; sub.remove(); authSub.subscription.unsubscribe(); };
  }, []);

  const strength = passwordStrength(password);
  const passwordsMatch = confirm.length === 0 || confirm === password;
  const canSubmit = password.length >= 6 && confirm === password;

  async function handleSave() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await authService.updatePassword(password);
      hapticSuccess();
      // Session de récupération fermée → connexion avec le nouveau mot de passe.
      await authService.signOut();
      Alert.alert("Mot de passe mis à jour", "Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.", [
        { text: "OK", onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Mise à jour échouée");
    } finally {
      setSaving(false);
    }
  }

  if (status === "checking") return <Loading />;

  if (status === "invalid") {
    return (
      <Screen>
        <FadeInView>
          <View style={styles.center}>
            <View style={styles.badgeWarn}>
              <Ionicons name="alert-circle-outline" size={34} color={colors.accent} />
            </View>
            <Text style={styles.title}>Lien invalide ou expiré</Text>
            <Text style={styles.message}>Le lien de réinitialisation n'est plus valide. Demandez-en un nouveau depuis « Mot de passe oublié ».</Text>
            <Button title="Retour à la connexion" onPress={() => router.replace("/(auth)/login")} />
          </View>
        </FadeInView>
      </Screen>
    );
  }

  return (
    <Screen keyboardAware>
      <FadeInView>
        <View style={styles.header}>
          <View style={styles.badge}>
            <Ionicons name="lock-closed-outline" size={30} color={colors.primaryDark} />
          </View>
          <Text style={styles.title}>Nouveau mot de passe</Text>
          <Text style={styles.message}>Choisissez un nouveau mot de passe pour votre compte.</Text>
        </View>

        <Input
          label="Nouveau mot de passe"
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          secureToggle
          textContentType="newPassword"
          placeholder="Au moins 6 caractères"
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          blurOnSubmit={false}
          validate={(v) => (v.length > 0 && v.length < 6 ? "Au moins 6 caractères." : null)}
        />

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
          onSubmitEditing={handleSave}
          validate={() => (!passwordsMatch ? "Les mots de passe ne correspondent pas." : null)}
        />

        <Button title="Mettre à jour le mot de passe" onPress={handleSave} loading={saving} disabled={!canSubmit} />
      </FadeInView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingHorizontal: spacing.lg },
  header: { alignItems: "center", marginTop: spacing.xxl, marginBottom: spacing.xl, gap: spacing.sm },
  badge: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  badgeWarn: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.warningSoft, alignItems: "center", justifyContent: "center" },
  title: { ...typography.h2, textAlign: "center" },
  message: { ...typography.body, color: colors.textMuted, textAlign: "center", paddingHorizontal: spacing.md },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: -spacing.xs, marginBottom: spacing.sm },
  strengthBars: { flexDirection: "row", gap: spacing.xs, flex: 1 },
  strengthBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.border },
  strengthLabel: { ...typography.caption, fontWeight: "700", width: 52, textAlign: "right" },
});
