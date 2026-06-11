import { useEffect, useState, useCallback } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/providers/AuthProvider";
import { adminService } from "@/lib/admin-service";
import type { AppSettings } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

type ToggleKey = "marketplace_enabled" | "doctors_enabled" | "premium_enabled" | "appointments_enabled";

const TOGGLES: { key: ToggleKey; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "marketplace_enabled", label: "Marketplace", sub: "Boutique et commandes", icon: "bag-handle-outline" },
  { key: "doctors_enabled", label: "Médecins", sub: "Annuaire des médecins", icon: "medkit-outline" },
  { key: "appointments_enabled", label: "Rendez-vous", sub: "Prise de rendez-vous", icon: "calendar-outline" },
  { key: "premium_enabled", label: "Premium", sub: "Abonnement premium", icon: "star-outline" },
];

export default function AdminSettings() {
  const { session } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<ToggleKey | null>(null);

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
      <AdminHeader title="Paramètres" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {!settings ? (
          <EmptyState
            icon="alert-circle-outline"
            title="Aucun paramètre"
            message="Aucune ligne de paramètres trouvée dans app_settings."
          />
        ) : (
          <Card style={styles.card}>
            <Text style={[typography.body, styles.intro]}>Activez ou désactivez les modules de l'application.</Text>
            {TOGGLES.map((t) => (
              <View key={t.key} style={styles.row}>
                <View style={styles.rowIcon}><Ionicons name={t.icon} size={20} color={colors.primary} /></View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowLabel}>{t.label}</Text>
                  <Text style={styles.rowSub}>{t.sub}</Text>
                </View>
                <Switch
                  value={!!settings[t.key]}
                  onValueChange={() => toggle(t.key)}
                  disabled={busyKey === t.key}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  empty: { alignItems: "center", gap: spacing.sm },
  muted: { color: colors.textMuted, textAlign: "center" },
  card: { gap: spacing.sm },
  intro: { color: colors.textMuted, marginBottom: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  rowIcon: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1, gap: 2 },
  rowLabel: { ...typography.body, fontWeight: "600" },
  rowSub: { ...typography.caption, color: colors.textMuted },
});
