import { useEffect, useState, useCallback } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { adminService } from "@/lib/admin-service";
import type { AppSettings } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

type ToggleKey = "marketplace_enabled" | "cycle_enabled" | "community_enabled" | "doctors_enabled" | "appointments_enabled" | "messaging_enabled";

const TOGGLES: { key: ToggleKey; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "marketplace_enabled", label: "Marketplace", sub: "Boutique et commandes pour les utilisatrices.", icon: "bag-handle-outline" },
  { key: "cycle_enabled", label: "Suivi du cycle", sub: "Calendrier, prédictions et journal du cycle.", icon: "water-outline" },
  { key: "community_enabled", label: "Communauté", sub: "Forum, publications et commentaires.", icon: "people-outline" },
  { key: "doctors_enabled", label: "Accès médecin", sub: "Annuaire des médecins et fiches publiques.", icon: "medkit-outline" },
  { key: "appointments_enabled", label: "Rendez-vous", sub: "Prise de rendez-vous payante avec les médecins.", icon: "calendar-outline" },
  { key: "messaging_enabled", label: "Téléconsultation / Messagerie", sub: "Messagerie en ligne patiente ↔ médecin.", icon: "chatbubbles-outline" },
];

export default function AdminSettings() {
  const { session } = useAuth();
  const toast = useToast();
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
      toast.error(e instanceof Error ? e.message : "Mise à jour échouée");
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
});
