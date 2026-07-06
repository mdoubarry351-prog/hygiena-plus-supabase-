import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { colors, radius, spacing, typography } from "@/theme";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function VerifyOtp() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { verifyPhoneOtp, signInWithPhone } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const inputRef = useRef<TextInput>(null);

  // Compte à rebours pour le renvoi du code.
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  async function handleVerify() {
    if (!phone || code.length < CODE_LENGTH) return;
    setVerifying(true);
    try {
      await verifyPhoneOtp(phone, code);
      // Succès : la session s'ouvre, (auth)/_layout redirige automatiquement.
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Vérifiez le code et réessayez.");
      setCode("");
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (countdown > 0 || !phone) return;
    try {
      await signInWithPhone(phone);
      setCountdown(RESEND_SECONDS);
      setCode("");
      toast.success("Un nouveau code vous a été envoyé par SMS.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  const mmss = `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")}`;

  return (
    <Screen keyboardAware>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
        <Text style={styles.backText}>Retour</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>Entrez le code</Text>
        <Text style={styles.subtitle}>Envoyé au {phone ?? "votre numéro"}</Text>
      </View>

      {/* Cases du code : 6 cases au-dessus d'un champ unique invisible */}
      <Pressable style={styles.boxesRow} onPress={() => inputRef.current?.focus()}>
        {Array.from({ length: CODE_LENGTH }).map((_, i) => {
          const active = i === code.length;
          return (
            <View key={i} style={[styles.box, (active || code[i]) && styles.boxActive]}>
              <Text style={styles.boxText}>{code[i] ?? ""}</Text>
            </View>
          );
        })}
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, CODE_LENGTH))}
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          style={styles.hiddenInput}
          caretHidden
          autoFocus
        />
      </Pressable>

      <Button
        title="Se connecter"
        onPress={handleVerify}
        loading={verifying}
        disabled={code.length < CODE_LENGTH}
      />

      <View style={styles.resendRow}>
        {countdown > 0 ? (
          <Text style={styles.resendMuted}>Renvoyer le code dans {mmss}</Text>
        ) : (
          <Pressable onPress={handleResend} hitSlop={8}>
            <Text style={styles.resendLink}>Renvoyer le code</Text>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", gap: 2, paddingTop: spacing.lg, marginLeft: -spacing.xs },
  backText: { ...typography.body, color: colors.text },
  header: { alignItems: "center", marginTop: spacing.xl, marginBottom: spacing.xl, gap: spacing.xs },
  title: { ...typography.h2 },
  subtitle: { ...typography.body, color: colors.textMuted, textAlign: "center" },
  boxesRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xl },
  box: {
    width: 48, height: 58, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
  },
  boxActive: { borderColor: colors.primary, backgroundColor: colors.white },
  boxText: { fontSize: 24, fontWeight: "700", color: colors.text },
  hiddenInput: { position: "absolute", width: "100%", height: "100%", opacity: 0 },
  resendRow: { marginTop: spacing.lg, alignItems: "center" },
  resendMuted: { ...typography.caption, color: colors.textMuted },
  resendLink: { ...typography.body, color: colors.primary, fontWeight: "700" },
});
