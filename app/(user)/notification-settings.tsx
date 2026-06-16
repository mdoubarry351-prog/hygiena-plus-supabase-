import { useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";
import { FadeInView } from "@/components/FadeInView";
import { useAuth } from "@/providers/AuthProvider";
import {
  NOTIF_PREF_DEFS,
  defaultPrefs,
  loadNotifPrefs,
  saveNotifPrefs,
  type NotifPrefs,
} from "@/lib/notification-prefs";
import {
  getPermissionStatus,
  requestPermission,
  isExpoGo,
  type PermStatus,
} from "@/lib/local-notifications";
import { resyncAllReminders } from "@/lib/reminders";
import { hapticLight } from "@/lib/haptics";
import { colors, radius, spacing, typography } from "@/theme";

export default function NotificationSettings() {
  const { session } = useAuth();
  const [prefs, setPrefs] = useState<NotifPrefs>(defaultPrefs());
  const [loading, setLoading] = useState(true);
  const [perm, setPerm] = useState<PermStatus>("undetermined");

  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, status] = await Promise.all([loadNotifPrefs(), getPermissionStatus()]);
      if (!alive) return;
      setPrefs(p);
      setPerm(status);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  function toggle(key: string, value: boolean) {
    hapticLight();
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      saveNotifPrefs(next); // persistance locale immédiate (best-effort)
      return next;
    });
    // Si on active une catégorie sans permission accordée, on la demande.
    if (value && perm !== "granted") {
      requestPermission().then((ok) => setPerm(ok ? "granted" : "denied"));
    }
    // Replanifie : active/annule les rappels locaux selon les nouvelles prefs.
    if (session?.user) resyncAllReminders(session.user.id);
  }

  async function enableNotifications() {
    const ok = await requestPermission();
    setPerm(ok ? "granted" : "denied");
    if (ok && session?.user) resyncAllReminders(session.user.id);
  }

  if (loading) return <Loading />;

  return (
    <Screen>
      <FadeInView>
        <ScreenHeader title="Préférences de notifications" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          <PermissionCard perm={perm} onEnable={enableNotifications} />

          <View style={styles.introRow}>
            <Ionicons name="notifications-outline" size={15} color={colors.primaryDark} />
            <Text style={styles.introText}>Choisissez les notifications que vous souhaitez recevoir. Ce réglage est enregistré sur cet appareil.</Text>
          </View>

          {NOTIF_PREF_DEFS.map((d) => (
            <Card key={d.key} style={styles.row}>
              <View style={styles.icon}>
                <Ionicons name={d.icon as keyof typeof Ionicons.glyphMap} size={20} color={colors.primary} />
              </View>
              <View style={styles.text}>
                <Text style={styles.label}>{d.label}</Text>
                <Text style={styles.sub}>{d.sub}</Text>
              </View>
              <Switch
                value={prefs[d.key] !== false}
                onValueChange={(v) => toggle(d.key, v)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.white}
              />
            </Card>
          ))}
        </ScrollView>
      </FadeInView>
    </Screen>
  );
}

// Carte d'état de la permission système (au-dessus des catégories).
function PermissionCard({ perm, onEnable }: { perm: PermStatus; onEnable: () => void }) {
  if (perm === "granted") {
    return (
      <Card style={[styles.permCard, styles.permOk]}>
        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
        <Text style={styles.permText}>Les notifications sont activées sur cet appareil. Les rappels (règles, ovulation, rendez-vous) arrivent même quand l'app est fermée.</Text>
      </Card>
    );
  }
  if (perm === "denied") {
    return (
      <Card style={[styles.permCard, styles.permWarn]}>
        <Ionicons name="notifications-off-outline" size={20} color={colors.accent} />
        <View style={styles.permBody}>
          <Text style={styles.permText}>Les notifications sont bloquées dans les réglages du téléphone. Activez-les pour recevoir vos rappels.</Text>
          <Button title="Ouvrir les réglages" variant="outline" onPress={() => Linking.openSettings()} />
        </View>
      </Card>
    );
  }
  if (perm === "unavailable") {
    return (
      <Card style={[styles.permCard, styles.permWarn]}>
        <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
        <Text style={styles.permText}>
          {isExpoGo
            ? "Les notifications locales sont limitées dans Expo Go. Utilisez un build de développement ou de production pour les recevoir."
            : "Les notifications ne sont pas disponibles sur cet appareil (simulateur)."}
        </Text>
      </Card>
    );
  }
  // undetermined
  return (
    <Card style={[styles.permCard, styles.permWarn]}>
      <Ionicons name="notifications-outline" size={20} color={colors.accent} />
      <View style={styles.permBody}>
        <Text style={styles.permText}>Autorisez les notifications pour recevoir vos rappels même quand l'app est fermée.</Text>
        <Button title="Activer les notifications" onPress={onEnable} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  permCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  permOk: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  permWarn: { backgroundColor: colors.surface },
  permBody: { flex: 1, gap: spacing.sm },
  permText: { ...typography.caption, color: colors.text, flex: 1 },
  introRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.primaryLight, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, marginBottom: spacing.xs },
  introText: { ...typography.caption, color: colors.primaryDark, flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  label: { ...typography.name },
  sub: { ...typography.caption, color: colors.textMuted },
});
