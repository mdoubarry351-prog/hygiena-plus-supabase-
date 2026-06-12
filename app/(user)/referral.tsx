import { useEffect, useState, useCallback } from "react";
import { Alert, Share, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import { hapticSuccess } from "@/lib/haptics";
import { colors, fonts, radius, spacing, typography } from "@/theme";

// Construit le message d'invitation partagé.
function inviteMessage(code: string): string {
  return `Rejoins-moi sur Hygiena+ ! Utilise mon code ${code} à l'inscription.`;
}

export default function Referral() {
  const { profile, refreshProfile } = useAuth();
  const code = profile?.referral_code ?? null;
  const alreadyReferred = !!profile?.referred_by;

  const [count, setCount] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [applying, setApplying] = useState(false);
  const [justApplied, setJustApplied] = useState(false);

  const loadCount = useCallback(async () => {
    const { data, error } = await supabase.rpc("my_referral_count");
    if (!error && typeof data === "number") setCount(data);
  }, []);

  useEffect(() => { loadCount(); }, [loadCount]);

  async function shareCode(message: string) {
    if (!code) return;
    try {
      await Share.share({ message });
    } catch {
      // partage annulé : rien à faire
    }
  }

  async function applyCode() {
    const c = input.trim();
    if (!c) { Alert.alert("Code requis", "Saisissez le code de parrainage d'une amie."); return; }
    setApplying(true);
    try {
      const { data, error } = await supabase.rpc("apply_referral", { p_code: c });
      if (error) throw error;
      if (data?.ok) {
        hapticSuccess();
        setJustApplied(true);
        setInput("");
        await refreshProfile();
        await loadCount();
        Alert.alert("Code appliqué ✅", "Votre parrainage a bien été enregistré.");
      } else {
        Alert.alert("Code non appliqué", referralError(data?.error));
      }
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Réessayez plus tard.");
    } finally {
      setApplying(false);
    }
  }

  // Le champ de saisie est masqué si déjà parrainée (referred_by rempli) ou si on vient d'appliquer un code.
  const showInput = !alreadyReferred && !justApplied;

  return (
    <Screen>
      <ScreenHeader title="Parrainage" />
      <View style={styles.content}>
        {/* Code de l'utilisatrice */}
        <Card style={styles.codeCard}>
          <Text style={styles.codeLabel}>Votre code de parrainage</Text>
          <Text style={styles.code} accessibilityLabel={`Votre code : ${code ?? "indisponible"}`}>
            {code ?? "—"}
          </Text>
          {count !== null ? (
            <Text style={styles.count}>
              {count} amie{count > 1 ? "s" : ""} parrainée{count > 1 ? "s" : ""}
            </Text>
          ) : null}
          {code ? (
            <View style={styles.actions}>
              <View style={styles.actionItem}>
                <Button title="Copier" variant="outline" onPress={() => shareCode(code)} />
              </View>
              <View style={styles.actionItem}>
                <Button title="Partager" onPress={() => shareCode(inviteMessage(code))} />
              </View>
            </View>
          ) : null}
        </Card>

        {/* Explication de l'avantage */}
        <Card style={styles.infoCard}>
          <Ionicons name="gift-outline" size={22} color={colors.primary} />
          <Text style={styles.infoText}>
            Quand une amie s'inscrit et entre ton code, tu reçois le Premium offert.
          </Text>
        </Card>

        {/* J'ai un code de parrainage */}
        {showInput ? (
          <Card style={styles.applyCard}>
            <Text style={typography.h3}>J'ai un code de parrainage</Text>
            <Text style={styles.applyHint}>Entrez le code d'une amie pour la remercier.</Text>
            <Input
              value={input}
              onChangeText={setInput}
              placeholder="Code de parrainage"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Button title="Valider" onPress={applyCode} loading={applying} />
          </Card>
        ) : (
          <Card style={styles.appliedCard}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <Text style={styles.appliedText}>
              {justApplied ? "Code appliqué ✅" : "Vous avez déjà été parrainée."}
            </Text>
          </Card>
        )}
      </View>
    </Screen>
  );
}

// Traduit l'erreur renvoyée par la RPC en message clair.
function referralError(err?: string): string {
  switch (err) {
    case "already_referred":
      return "Vous avez déjà utilisé un code de parrainage.";
    case "invalid_code":
      return "Ce code est invalide. Vérifiez et réessayez.";
    case "self_referral":
      return "Vous ne pouvez pas utiliser votre propre code.";
    default:
      return err || "Ce code n'a pas pu être appliqué.";
  }
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingTop: spacing.md, gap: spacing.md },
  codeCard: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  codeLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "700" },
  code: {
    fontSize: 34, fontFamily: fonts.titleBold, fontWeight: "700", color: colors.primaryDark,
    letterSpacing: 4, textAlign: "center",
  },
  count: { ...typography.body, color: colors.text, fontWeight: "600" },
  actions: { flexDirection: "row", gap: spacing.sm, alignSelf: "stretch", marginTop: spacing.xs },
  actionItem: { flex: 1 },
  infoCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.primaryLight },
  infoText: { ...typography.body, color: colors.primaryDark, flex: 1 },
  applyCard: { gap: spacing.sm },
  applyHint: { ...typography.caption, color: colors.textMuted },
  appliedCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  appliedText: { ...typography.name, color: colors.text, flex: 1 },
});
