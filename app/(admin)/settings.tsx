import { useEffect, useState, useCallback } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/providers/AuthProvider";
import { adminService } from "@/lib/admin-service";
import { PREMIUM_ENABLED } from "@/lib/app-config";
import type { AppSettings } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

type ToggleKey = "marketplace_enabled" | "cycle_enabled" | "community_enabled" | "doctors_enabled" | "premium_enabled" | "appointments_enabled" | "messaging_enabled";

const ALL_TOGGLES: { key: ToggleKey; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "marketplace_enabled", label: "Marketplace", sub: "Boutique et commandes pour les utilisatrices.", icon: "bag-handle-outline" },
  { key: "cycle_enabled", label: "Suivi du cycle", sub: "Calendrier, prédictions et journal du cycle.", icon: "water-outline" },
  { key: "community_enabled", label: "Communauté", sub: "Forum, publications et commentaires.", icon: "people-outline" },
  { key: "doctors_enabled", label: "Accès médecin", sub: "Annuaire des médecins et fiches publiques.", icon: "medkit-outline" },
  { key: "appointments_enabled", label: "Rendez-vous", sub: "Prise de rendez-vous payante avec les médecins.", icon: "calendar-outline" },
  { key: "messaging_enabled", label: "Téléconsultation / Messagerie", sub: "Messagerie en ligne patiente ↔ médecin.", icon: "chatbubbles-outline" },
  { key: "premium_enabled", label: "Premium", sub: "Abonnement premium et avantages associés.", icon: "star-outline" },
];

// Toggle Premium retiré de l'UI tant que le Premium est désactivé (réversible).
const TOGGLES = PREMIUM_ENABLED ? ALL_TOGGLES : ALL_TOGGLES.filter((t) => t.key !== "premium_enabled");

export default function AdminSettings() {
  const { session } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<ToggleKey | null>(null);
  const [priceStr, setPriceStr] = useState("");
  const [durationStr, setDurationStr] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSettings(await adminService.getSettings());
    } catch {
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Pré-remplit les champs de tarification dès que les réglages sont chargés.
  useEffect(() => {
    if (settings) {
      setPriceStr(String(settings.premium_price ?? 50000));
      setDurationStr(String(settings.premium_duration_days ?? 30));
    }
  }, [settings]);

  // Enregistre le prix + la durée du Premium (même mécanisme que les toggles).
  async function savePricing() {
    if (!session?.user || !settings) return;
    const price = Number(priceStr.replace(/\s/g, ""));
    const days = Number(durationStr.replace(/\s/g, ""));
    if (Number.isNaN(price) || price < 0) { Alert.alert("Prix invalide", "Le prix doit être un nombre positif ou nul."); return; }
    if (Number.isNaN(days) || days < 1 || !Number.isInteger(days)) { Alert.alert("Durée invalide", "La durée doit être un entier supérieur ou égal à 1."); return; }
    setSavingPrice(true);
    try {
      const updated = await adminService.updateSettings(session.user.id, settings.id, {
        premium_price: price,
        premium_duration_days: days,
        updated_by: session.user.id,
      });
      setSettings(updated);
      Alert.alert("Enregistré", "La tarification Premium a été mise à jour.");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Mise à jour échouée");
    } finally {
      setSavingPrice(false);
    }
  }

  async function toggle(key: ToggleKey) {
    if (!session?.user || !settings) return;
    const next = !settings[key];
    setSettings({ ...settings, [key]: next });
    setBusyKey(key);
    try {
      await adminService.updateSettings(session.user.id, settings.id, { [key]: next });
    } catch (e) {
      setSettings((s) => (s ? { ...s, [key]: !next } : s)); // rollback
      Alert.alert("Erreur", e instanceof Error ? e.message : "Mise à jour échouée");
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) return <Loading />;

  return (
    <Screen>
      <AdminHeader title="Gestion des services" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Activez ou désactivez les services proposés aux utilisatrices.</Text>

        {/* Bandeau d'information */}
        <View style={styles.banner}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primaryDark} />
          <Text style={styles.bannerText}>
            Aucune fonctionnalité n'est supprimée. Les réglages sont enregistrés en base et restent actifs après une
            déconnexion ou un redémarrage de l'application.
          </Text>
        </View>

        {!settings ? (
          <EmptyState
            icon="alert-circle-outline"
            title="Aucun paramètre"
            message="Aucune ligne de paramètres trouvée dans app_settings."
          />
        ) : (
          <>
            {TOGGLES.map((t) => {
              const on = !!settings[t.key];
              return (
                <Card key={t.key} style={styles.moduleCard}>
                  <View style={[styles.moduleIcon, { backgroundColor: on ? colors.primaryLight : colors.surface }]}>
                    <Ionicons name={t.icon} size={22} color={on ? colors.primaryDark : colors.textMuted} />
                  </View>
                  <View style={styles.moduleInfo}>
                    <Text style={styles.moduleTitle}>{t.label}</Text>
                    <Text style={styles.moduleSub}>{t.sub}</Text>
                  </View>
                  <View style={styles.moduleToggle}>
                    <Text style={[styles.statusLabel, on ? styles.statusOn : styles.statusOff]}>
                      {on ? "ACTIVÉ" : "DÉSACTIVÉ"}
                    </Text>
                    <Switch
                      value={on}
                      onValueChange={() => toggle(t.key)}
                      disabled={busyKey === t.key}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={colors.white}
                    />
                  </View>
                </Card>
              );
            })}

            {/* Tarification Premium (modifiable par l'admin) — masquée tant que
                le Premium est retiré (PREMIUM_ENABLED=false, réversible). */}
            {PREMIUM_ENABLED ? (
              <Card style={styles.priceCard}>
                <View style={styles.priceHead}>
                  <View style={[styles.moduleIcon, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="cash-outline" size={22} color={colors.primaryDark} />
                  </View>
                  <View style={styles.moduleInfo}>
                    <Text style={styles.moduleTitle}>Tarification Premium</Text>
                    <Text style={styles.moduleSub}>Prix et durée de l'abonnement (paiement simulé).</Text>
                  </View>
                </View>
                <Input label="Prix de l'abonnement Premium (GNF)" value={priceStr} onChangeText={setPriceStr} keyboardType="numeric" placeholder="Ex. 50000" />
                <Input label="Durée (jours)" value={durationStr} onChangeText={setDurationStr} keyboardType="numeric" placeholder="Ex. 30" />
                <Button title="Enregistrer la tarification" onPress={savePricing} loading={savingPrice} />
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  subtitle: { ...typography.caption, color: colors.textMuted },
  banner: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.md, alignItems: "flex-start" },
  bannerText: { ...typography.caption, color: colors.primaryDark, flex: 1, lineHeight: 18 },
  moduleCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  moduleIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  moduleInfo: { flex: 1, gap: 2 },
  moduleTitle: { ...typography.name },
  moduleSub: { ...typography.caption, color: colors.textMuted },
  moduleToggle: { alignItems: "flex-end", gap: spacing.xs },
  statusLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  statusOn: { color: colors.primaryDark },
  statusOff: { color: colors.textMuted },
  priceCard: { gap: spacing.sm },
  priceHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
});
