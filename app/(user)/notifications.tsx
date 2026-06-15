import { memo, useCallback, useMemo, useState } from "react";
import {
  FlatList, LayoutAnimation, Platform, Pressable, RefreshControl,
  StyleSheet, Text, UIManager, View, type ListRenderItemInfo,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SkeletonList } from "@/components/Skeleton";
import { FadeInView } from "@/components/FadeInView";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useConfirm } from "@/components/ConfirmDialog";
import { useNotifications } from "@/hooks/useNotifications";
import { formatRelativeTime } from "@/lib/community-service";
import { defaultPrefs, loadNotifPrefs, isNotifEnabled, type NotifPrefs } from "@/lib/notification-prefs";
import { NOTIF_CATEGORIES, categoryOf, typeMeta, type NotifCategoryKey } from "@/lib/notification-meta";
import { notificationRoute, type NotifData } from "@/lib/notification-routing";
import type { Notification } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type CatFilter = NotifCategoryKey | "all";

export default function Notifications() {
  const { notifications, unreadCount, loading, error, reload, markAsRead, markAllAsRead, deleteNotification, deleteAll } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [prefs, setPrefs] = useState<NotifPrefs>(defaultPrefs());
  const [cat, setCat] = useState<CatFilter>("all");
  const router = useRouter();
  const confirm = useConfirm();

  // Recharge la liste ET les préférences au focus (point 15 : pas de refetch inutile).
  useFocusEffect(useCallback(() => {
    reload();
    loadNotifPrefs().then(setPrefs);
  }, [reload]));

  // Filtre par préférences (type non mappé = visible), puis par catégorie sélectionnée.
  const visible = useMemo(() => notifications.filter((n) => isNotifEnabled(prefs, n.type)), [notifications, prefs]);
  const presentCats = useMemo(() => {
    const set = new Set<NotifCategoryKey>();
    for (const n of visible) set.add(categoryOf(n.type));
    return NOTIF_CATEGORIES.filter((c) => set.has(c.key));
  }, [visible]);
  const data = useMemo(
    () => (cat === "all" ? visible : visible.filter((n) => categoryOf(n.type) === cat)),
    [visible, cat]
  );

  // Navigation selon data.kind / type — via la source unique partagée avec le
  // routage des notifications push/locales (notification-routing.ts).
  const openNotif = useCallback((n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    const route = notificationRoute((n.data ?? null) as NotifData, n.type);
    if (route) router.push(route);
  }, [markAsRead, router]);

  const removeNotif = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    deleteNotification(id);
  }, [deleteNotification]);

  async function confirmDeleteAll() {
    const ok = await confirm({
      title: "Tout supprimer ?",
      message: "Toutes tes notifications seront définitivement supprimées.",
      confirmLabel: "Tout supprimer",
      danger: true,
    });
    if (ok) { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); deleteAll(); }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const keyExtractor = useCallback((item: Notification) => item.id, []);
  const extra = useMemo(() => ({ cat, unreadCount }), [cat, unreadCount]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Notification>) => (
      <NotificationRow notification={item} onOpen={openNotif} onDelete={removeNotif} />
    ),
    [openNotif, removeNotif]
  );

  if (loading && notifications.length === 0) return <SkeletonList variant="notification" />;

  // Échec réseau SANS aucune donnée : vrai état d'erreur (≠ « aucune notification »).
  if (error && notifications.length === 0) {
    return (
      <Screen>
        <ScreenHeader title="Notifications" />
        <EmptyState
          icon="cloud-offline-outline"
          title="Connexion impossible"
          message="Vérifie ta connexion, puis réessaie."
          actionLabel="Réessayer"
          onAction={reload}
        />
      </Screen>
    );
  }

  const emptyMessage =
    notifications.length === 0
      ? "Tu n'as aucune notification pour le moment."
      : cat !== "all"
      ? "Aucune notification dans cette catégorie."
      : "Aucune notification ne correspond à tes préférences.";

  const listHeader = (
    <View>
      {/* Données déjà chargées mais le rafraîchissement a échoué → hors-ligne. */}
      {error ? <OfflineBanner cachedAt={null} /> : null}

      {notifications.length > 0 ? (
        <View style={styles.actionsRow}>
          {unreadCount > 0 ? (
            <Pressable onPress={markAllAsRead} style={styles.actionBtn} hitSlop={6} accessibilityRole="button" accessibilityLabel="Tout marquer comme lu">
              <Ionicons name="checkmark-done-outline" size={16} color={colors.primary} />
              <Text style={styles.actionText}>Tout marquer comme lu</Text>
            </Pressable>
          ) : <View />}
          <Pressable onPress={confirmDeleteAll} style={styles.actionBtn} hitSlop={6} accessibilityRole="button" accessibilityLabel="Tout supprimer">
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={[styles.actionText, styles.actionDanger]}>Tout supprimer</Text>
          </Pressable>
        </View>
      ) : null}

      {visible.length > 0 ? (
        <SegmentedControl
          items={[{ key: "all", label: "Toutes", icon: "notifications-outline" }, ...presentCats.map((c) => ({ key: c.key, label: c.label, icon: c.icon }))]}
          value={cat}
          onChange={(k) => setCat(k as CatFilter)}
        />
      ) : null}
    </View>
  );

  return (
    <Screen>
      <ScreenHeader
        title="Notifications"
        right={
          <Pressable onPress={() => router.push("/(user)/notification-settings")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Préférences de notifications">
            <Ionicons name="options-outline" size={22} color={colors.text} />
          </Pressable>
        }
      />
      <FadeInView>
        <FlatList
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          extraData={extra}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="Aucune notification" message={emptyMessage} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={11}
        />
      </FadeInView>
    </Screen>
  );
}

// Ligne mémoïsée : ne se re-render que si la notification, onOpen ou onDelete changent.
const NotificationRow = memo(function NotificationRow({
  notification, onOpen, onDelete,
}: {
  notification: Notification;
  onOpen: (n: Notification) => void;
  onDelete: (id: string) => void;
}) {
  const unread = !notification.is_read;
  const meta = typeMeta(notification.type);
  return (
    <Card style={[styles.row, unread && styles.rowUnread]}>
      <Pressable style={styles.rowMain} onPress={() => onOpen(notification)} accessibilityRole="button" accessibilityLabel={notification.title}>
        <View style={styles.iconCol}>
          <View style={[styles.iconWrap, unread && styles.iconWrapUnread]}>
            <Ionicons name={meta.icon} size={18} color={meta.color} />
          </View>
          {unread && <View style={styles.dot} />}
        </View>
        <View style={styles.body}>
          <View style={styles.headRow}>
            <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={1}>{notification.title}</Text>
            <Text style={styles.time}>{formatRelativeTime(notification.created_at)}</Text>
          </View>
          <Text style={styles.message} numberOfLines={3}>{notification.message}</Text>
        </View>
      </Pressable>
      <Pressable onPress={() => onDelete(notification.id)} hitSlop={8} style={styles.deleteBtn} accessibilityRole="button" accessibilityLabel="Supprimer la notification">
        <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
      </Pressable>
    </Card>
  );
});

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  actionsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  actionText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  actionDanger: { color: colors.danger },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  rowUnread: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
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
  deleteBtn: { padding: spacing.xs },
});
