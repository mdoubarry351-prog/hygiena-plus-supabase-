import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/Button";
import { useAppLock } from "@/providers/AppLockProvider";
import { appLock, authenticateBiometric } from "@/lib/app-lock";
import { colors, radius, spacing, typography } from "@/theme";

const logo = require("../../assets/logo/hygiena-icon-1024.png");

export function LockScreen() {
  const { biometric, unlock } = useAppLock();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tryBiometric = useCallback(async () => {
    const ok = await authenticateBiometric();
    if (ok) unlock();
  }, [unlock]);

  // Invite biométrique automatique à l'ouverture si activée.
  useEffect(() => {
    if (biometric) tryBiometric();
  }, [biometric, tryBiometric]);

  const verify = useCallback(async (value: string) => {
    const ok = await appLock.verifyPin(value);
    if (ok) {
      unlock();
    } else {
      setError("Code incorrect, réessayez.");
      setPin("");
    }
  }, [unlock]);

  async function onChange(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 6);
    setPin(digits);
    setError(null);
    if (digits.length >= 4) {
      // Tente le déverrouillage dès que le code saisi correspond (4–6 chiffres).
      const ok = await appLock.verifyPin(digits);
      if (ok) unlock();
      else if (digits.length === 6) { setError("Code incorrect, réessayez."); setPin(""); }
    }
  }

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.inner}>
          <View style={styles.logoWrap}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.title}>Application verrouillée</Text>
          <Text style={styles.subtitle}>Saisissez votre code pour continuer.</Text>

          <TextInput
            style={styles.pinInput}
            value={pin}
            onChangeText={onChange}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            autoFocus
            placeholder="••••"
            placeholderTextColor={colors.textMuted}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Button title="Déverrouiller" onPress={() => verify(pin)} disabled={pin.length < 4} />
            {biometric ? (
              <Pressable onPress={tryBiometric} style={styles.bioBtn}>
                <Ionicons name="finger-print" size={20} color={colors.primary} />
                <Text style={styles.bioText}>Utiliser la biométrie</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.background, zIndex: 1000 },
  safe: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: spacing.xl, alignItems: "center", justifyContent: "center", gap: spacing.md },
  logoWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  logo: { width: 64, height: 64 },
  title: { ...typography.h2 },
  subtitle: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
  pinInput: {
    width: 200, textAlign: "center", fontSize: 28, letterSpacing: 8,
    paddingVertical: spacing.sm, borderBottomWidth: 2, borderBottomColor: colors.primary,
    color: colors.text, marginTop: spacing.md,
  },
  error: { ...typography.caption, color: colors.danger, fontWeight: "700" },
  actions: { width: "100%", gap: spacing.sm, marginTop: spacing.lg },
  bioBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.sm },
  bioText: { ...typography.body, color: colors.primary, fontWeight: "700" },
});
