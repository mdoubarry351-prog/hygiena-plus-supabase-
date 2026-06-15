import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Loading } from "@/components/Loading";
import { FadeInView } from "@/components/FadeInView";
import {
  NOTIF_PREF_DEFS,
  defaultPrefs,
  loadNotifPrefs,
  saveNotifPrefs,
  type NotifPrefs,
} from "@/lib/notification-prefs";
import { colors, radius, spacing, typography } from "@/theme";

export default function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotifPrefs>(defaultPrefs());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    loadNotifPrefs().then((p) => { if (alive) { setPrefs(p); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  function toggle(key: string, value: boolean) {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      saveNotifPrefs(next); // persistance locale immédiate (best-effort)
      return next;
    });
  }

  if (loading) return <Loading />;

  return (
    <Screen>
      <FadeInView>
        <ScreenHeader title="Préférences de notifications" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.introRow}>
            <Ionicons name="notifications-outline" size={15} color={colors.primaryDark} />
            <Text style={styles.introText}>Choisissez les notifications que vous souhaitez voir. Ce réglage est enregistré sur cet appareil.</Text>
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

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  introRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.primaryLight, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, marginBottom: spacing.xs },
  introText: { ...typography.caption, color: colors.primaryDark, flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  label: { ...typography.name },
  sub: { ...typography.caption, color: colors.textMuted },
});
