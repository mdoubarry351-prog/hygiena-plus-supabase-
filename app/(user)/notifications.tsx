import { useState, useCallback } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Loading } from "@/components/Loading";
import { useNotifications } from "@/hooks/useNotifications";
import { formatRelativeTime } from "@/lib/community-service";
import type { Notification } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

// Icône + couleur selon le type de notification.
type NotifMeta = { icon: keyof typeof Ionicons.glyphMap; color: string };
const TYPE_META: Record<string, NotifMeta> = {
  community_comment: { icon: "chatbubble", color: colors.primary },
  community_like: { icon: "heart", color: colors.danger },
  appointment_new: { icon: "medkit", color: colors.secondary },
  appointment_status: { icon: "calendar", color: colors.primary },
  appointment_reminder: { icon: "alarm", color: colors.secondary },
  cycle_period_soon: { icon: "water", color: colors.danger },
  cycle_fertile: { icon: "leaf", color: colors.primary },
  cycle_ovulation: { icon: "ellipse", color: colors.secondary },
};
const DEFAULT_META: NotifMeta = { icon: "notifications", color: colors.primary };
function metaFor(type: string | null): NotifMeta {
  return (type && TYPE_META[type]) || DEFAULT_META;
}

// Contexte de navigation transporté par la notification (colonne data jsonb).
type NotifData = { kind?: string; postId?: string; appointmentId?: string } | null;

export default function Notifications() {
  const { notifications, unreadCount, loading, reload, markAsRead, markAllAsRead } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  // Marque comme lue + navigue selon data.kind (si présent).
  function handlePress(n: Notification) {
    if (!n.is_read) markAsRead(n.id);
    const data = (n.data ?? null) as unknown as NotifData;
    const kind = data?.kind;
    if (kind === "post" && data?.postId) {
      router.push({ pathname: "/(user)/community/[id]", params: { id: data.postId } });
    } else if (kind === "my_appointments") {
      router.push("/(user)/appointments/mine");
    } else if (kind === "doctor_appointments") {
      router.push("/(doctor)/appointments");
    }
    // Pas de data exploitable → on se contente de marquer comme lu.
  }

  async function onRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  if (loading && notifications.length === 0) return <Loading />;

  return (
    <Screen>
      <ScreenHeader
        title="Notifications"
        right={
          unreadCount > 0 ? (
            <Pressable onPress={markAllAsRead} hitSlop={10} style={styles.markAllBtn}>
              <Ionicons name="checkmark-done-outline" size={18} color={colors.primary} />
              <Text style={styles.markAllText}>Tout marquer comme lu</Text>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {notifications.length === 0 ? (
          <EmptyState
            icon="notifications-off-outline"
            title="Aucune notification"
            message="Vous serez notifiée ici de vos rendez-vous, commandes et nouveautés."
          />
        ) : (
          notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} meta={metaFor(n.type)} onPress={() => handlePress(n)} />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function NotificationRow({ notification, meta, onPress }: { notification: Notification; meta: NotifMeta; onPress: () => void }) {
  const unread = !notification.is_read;
  return (
    <Pressable onPress={onPress}>
      <Card style={[styles.row, unread && styles.rowUnread]}>
        <View style={styles.iconCol}>
          <View style={[styles.iconWrap, unread && styles.iconWrapUnread]}>
            <Ionicons name={meta.icon} size={18} color={meta.color} />
          </View>
          {unread && <View style={styles.dot} />}
        </View>
        <View style={styles.body}>
          <View style={styles.headRow}>
            <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={1}>
              {notification.title}
            </Text>
            <Text style={styles.time}>{formatRelativeTime(notification.created_at)}</Text>
          </View>
          <Text style={styles.message} numberOfLines={3}>{notification.message}</Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.lg, gap: spacing.sm },
  markAllBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  markAllText: { ...typography.caption, color: colors.primary, fontWeight: "600" },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  empty: { alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  muted: { color: colors.textMuted, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  rowUnread: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  iconCol: { width: 40, alignItems: "center" },
  iconWrap: {
    width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center",
  },
  iconWrapUnread: { backgroundColor: colors.white },
  dot: { position: "absolute", top: 0, right: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  body: { flex: 1, gap: 2 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  title: { ...typography.name, flex: 1 },
  titleUnread: { fontWeight: "700" },
  time: { ...typography.caption, color: colors.textMuted },
  message: { ...typography.body, color: colors.textMuted, lineHeight: 21 },
});
