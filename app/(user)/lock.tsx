import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useToast } from "@/providers/ToastProvider";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAppLock } from "@/providers/AppLockProvider";
import { appLock, authenticateBiometric, isBiometricAvailable } from "@/lib/app-lock";
import { colors, radius, spacing, typography } from "@/theme";

type Mode = "enable" | "change" | "disable" | null;
type Step = "current" | "new" | "confirm";

export default function LockSettings() {
  const { enabled, biometric, refresh } = useAppLock();
  const toast = useToast();
  const [bioAvailable, setBioAvailable] = useState(false);

  const [mode, setMode] = useState<Mode>(null);
  const [step, setStep] = useState<Step>("new");
  const [entry, setEntry] = useState("");
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { isBiometricAvailable().then(setBioAvailable); }, []);

  function closeFlow() { setMode(null); setEntry(""); setNewPin(""); setError(null); }

  function onToggleLock(value: boolean) {
    setError(null);
    if (value) { setMode("enable"); setStep("new"); setEntry(""); setNewPin(""); }
    else { setMode("disable"); setStep("current"); setEntry(""); setNewPin(""); }
  }

  function startChange() { setError(null); setMode("change"); setStep("current"); setEntry(""); setNewPin(""); }

  async function onToggleBiometric(value: boolean) {
    await appLock.setBiometric(value);
    await refresh();
  }

  async function submitStep() {
    setError(null);
    if (step === "current") {
      setBusy(true);
      const ok = await appLock.verifyPin(entry);
      setBusy(false);
      if (!ok) { setError("Code actuel incorrect."); setEntry(""); return; }
      if (mode === "disable") { await finishDisable(); }
      else { setStep("new"); setEntry(""); }
      return;
    }
    if (step === "new") {
      if (!/^\d{4,6}$/.test(entry)) { setError("Le code doit comporter 4 à 6 chiffres."); return; }
      setNewPin(entry); setStep("confirm"); setEntry("");
      return;
    }
    // step === "confirm"
    if (entry !== newPin) { setError("Les deux codes ne correspondent pas."); setEntry(""); return; }
    setBusy(true);
    await appLock.enableLock(newPin); // pose le code + active (idempotent pour « change »)
    await refresh();
    setBusy(false);
    closeFlow();
    toast.success(mode === "change" ? "Code modifié" : "Verrouillage activé");
  }

  async function finishDisable() {
    await appLock.disableLock();
    await refresh();
    closeFlow();
    toast.success("Verrouillage désactivé");
  }

  // Déverrouillage de l'étape « code actuel » par biométrie (désactivation / modification).
  async function currentViaBiometric() {
    const ok = await authenticateBiometric();
    if (!ok) return;
    if (mode === "disable") await finishDisable();
    else { setStep("new"); setEntry(""); }
  }

  const stepTitle =
    step === "current" ? "Saisissez votre code actuel"
    : step === "new" ? (mode === "change" ? "Nouveau code (4 à 6 chiffres)" : "Choisissez un code (4 à 6 chiffres)")
    : "Confirmez le code";

  return (
    <Screen>
      <ScreenHeader title="Verrouillage" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Protégez l'accès à l'application par un code et, si disponible, la biométrie. Tout reste sur votre appareil.
        </Text>

        {/* Activer / désactiver */}
        <Card style={styles.row}>
          <View style={styles.rowIcon}><Ionicons name="lock-closed-outline" size={20} color={colors.primary} /></View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Verrouiller l'application</Text>
            <Text style={styles.rowSub}>{enabled ? "Activé" : "Désactivé"}</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={onToggleLock}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </Card>

        {enabled ? (
          <>
            {bioAvailable ? (
              <Card style={styles.row}>
                <View style={styles.rowIcon}><Ionicons name="finger-print" size={20} color={colors.primary} /></View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>Déverrouiller avec la biométrie</Text>
                  <Text style={styles.rowSub}>Face ID / empreinte digitale</Text>
                </View>
                <Switch
                  value={biometric}
                  onValueChange={onToggleBiometric}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </Card>
            ) : null}

            <Pressable onPress={startChange}>
              <Card style={styles.row}>
                <View style={styles.rowIcon}><Ionicons name="key-outline" size={20} color={colors.primary} /></View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>Modifier le code</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Card>
            </Pressable>
          </>
        ) : null}

        {/* Flux de saisie (activation / modification / désactivation) */}
        {mode ? (
          <Card style={styles.flowCard}>
            <Text style={styles.flowTitle}>{stepTitle}</Text>
            <Input
              value={entry}
              onChangeText={(v) => { setEntry(v.replace(/\D/g, "").slice(0, 6)); setError(null); }}
              placeholder="••••"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              autoFocus
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}

            {step === "current" && bioAvailable ? (
              <Pressable onPress={currentViaBiometric} style={styles.bioBtn}>
                <Ionicons name="finger-print" size={18} color={colors.primary} />
                <Text style={styles.bioText}>Utiliser la biométrie</Text>
              </Pressable>
            ) : null}

            <Button
              title={step === "new" ? "Continuer" : step === "confirm" ? "Valider" : mode === "disable" ? "Désactiver" : "Valider"}
              onPress={submitStep}
              loading={busy}
              disabled={entry.length < 4}
            />
            <Button title="Annuler" variant="outline" onPress={closeFlow} />
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  subtitle: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1, gap: 2 },
  rowTitle: { ...typography.name },
  rowSub: { ...typography.caption, color: colors.textMuted },
  flowCard: { gap: spacing.sm, marginTop: spacing.sm },
  flowTitle: { ...typography.h3 },
  error: { ...typography.caption, color: colors.danger, fontWeight: "700" },
  bioBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.xs },
  bioText: { ...typography.body, color: colors.primary, fontWeight: "700" },
});
