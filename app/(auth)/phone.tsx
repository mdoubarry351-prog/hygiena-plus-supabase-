import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { PhoneInput } from "@/components/PhoneInput";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { onlyDigits, toE164, isValidGuineaLocal } from "@/lib/phone";
import { todayISO } from "@/lib/dates";
import { colors, radius, shadows, spacing, typography } from "@/theme";

const logo = require("../../assets/logo/hygiena-icon-drop.png");

// Garde-fous anti « SMS bombing » CÔTÉ UI (défense en profondeur). Le vrai
// rate-limit + le plafond quotidien restent SERVEUR (Supabase → Auth → Rate
// limits / SMS), à activer par le propriétaire.
const SMS_COOLDOWN_MS = 60_000;   // 1 min entre deux envois
const SMS_DAILY_CAP = 5;          // 5 SMS max / jour / appareil
const KEY_SMS_LAST = "sms_last_send_ts";
const KEY_SMS_DAY = "sms_send_day";
const KEY_SMS_COUNT = "sms_send_count";

export default function PhoneLogin() {
  const { signInWithPhone } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [numero, setNumero] = useState(""); // valeur AFFICHÉE (formatée à tirets)
  const [loading, setLoading] = useState(false);

  // Vérifie cooldown + plafond quotidien. Renvoie un message si bloqué, sinon null.
  async function smsThrottleBlock(): Promise<string | null> {
    const now = Date.now();
    const [lastRaw, dayRaw, countRaw] = await Promise.all([
      AsyncStorage.getItem(KEY_SMS_LAST),
      AsyncStorage.getItem(KEY_SMS_DAY),
      AsyncStorage.getItem(KEY_SMS_COUNT),
    ]);
    const last = Number(lastRaw) || 0;
    if (now - last < SMS_COOLDOWN_MS) {
      const s = Math.ceil((SMS_COOLDOWN_MS - (now - last)) / 1000);
      return `Patiente ${s}s avant de redemander un code.`;
    }
    const today = todayISO();
    const count = dayRaw === today ? Number(countRaw) || 0 : 0;
    if (count >= SMS_DAILY_CAP) {
      return "Limite de SMS atteinte pour aujourd'hui. Réessaie demain ou connecte-toi par e-mail.";
    }
    return null;
  }

  async function recordSmsSent() {
    const today = todayISO();
    const dayRaw = await AsyncStorage.getItem(KEY_SMS_DAY);
    const countRaw = await AsyncStorage.getItem(KEY_SMS_COUNT);
    const count = dayRaw === today ? Number(countRaw) || 0 : 0;
    await AsyncStorage.multiSet([
      [KEY_SMS_LAST, String(Date.now())],
      [KEY_SMS_DAY, today],
      [KEY_SMS_COUNT, String(count + 1)],
    ]);
  }

  async function handleSendCode() {
    const local = onlyDigits(numero);
    if (!isValidGuineaLocal(local)) {
      toast.error("Saisissez un numéro guinéen à 9 chiffres (ex. 620-00-10-01).");
      return;
    }
    const blocked = await smsThrottleBlock();
    if (blocked) { toast.error(blocked); return; }

    const phone = toE164(local); // « +224XXXXXXXXX » envoyé à l'OTP
    setLoading(true);
    try {
      await signInWithPhone(phone);
      await recordSmsSent();
      router.push({ pathname: "/(auth)/verify", params: { phone } });
    } catch {
      // Message générique (ne révèle pas si le numéro existe — anti-énumération).
      toast.error("Envoi impossible pour le moment. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen keyboardAware>
      <View style={[styles.glow, { pointerEvents: "none" }]} />

      <View style={styles.header}>
        <View style={styles.logoHalo}>
          <Image source={logo} style={styles.logoImg} resizeMode="contain" />
        </View>
        <Text style={styles.title}>Bon retour</Text>
        <Text style={styles.tagline}>Connectez-vous pour retrouver votre suivi</Text>
      </View>

      <View style={styles.card}>
        <PhoneInput
          label="Numéro de téléphone"
          value={numero}
          onChangeText={(f) => setNumero(f)}
          autoFocus
        />
        <Text style={styles.hint}>Un code vous sera envoyé par SMS.</Text>
        <Button title="Recevoir le code" onPress={handleSendCode} loading={loading} />
      </View>

      <View style={styles.footer}>
        <Link href="/(auth)/login" style={styles.link}>
          Se connecter par <Text style={styles.linkStrong}>email</Text>
        </Link>
      </View>
    </Screen>
  );
}

const HALO = 112;
const styles = StyleSheet.create({
  glow: {
    position: "absolute", top: -150, left: -60, right: -60, height: 300,
    borderRadius: 200, backgroundColor: colors.primaryLight, opacity: 0.5,
  },
  header: { alignItems: "center", marginTop: spacing.xl, marginBottom: spacing.lg, gap: spacing.xs },
  logoHalo: {
    width: HALO, height: HALO, borderRadius: HALO / 2, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.primaryDark, shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  logoImg: { width: 64, height: 64 },
  title: { ...typography.h2, color: colors.text, marginTop: spacing.sm },
  tagline: { ...typography.body, color: colors.textMuted, textAlign: "center" },
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
    ...shadows.sm,
  },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  footer: { marginTop: spacing.xl, alignItems: "center" },
  link: { ...typography.body, color: colors.textMuted },
  linkStrong: { color: colors.primary, fontWeight: "700" },
});
