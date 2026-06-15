import { memo, useCallback, useMemo, useState } from "react";
import {
  Alert, FlatList, LayoutAnimation, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, UIManager, View, type ListRenderItemInfo,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonList } from "@/components/Skeleton";
import { FadeInView } from "@/components/FadeInView";
import { useNotifications } from "@/hooks/useNotifications";
import { formatRelativeTime } from "@/lib/community-service";
import { defaultPrefs, loadNotifPrefs, isNotifEnabled, type NotifPrefs } from "@/lib/notification-prefs";
import { NOTIF_CATEGORIES, categoryOf, typeMeta, type NotifCategoryKey } from "@/lib/notification-meta";
import type { Notification } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Contexte de navigation transporté par la notification (colonne data jsonb).
type NotifData = { kind?: string; postId?: string; appointmentId?: string; doctorId?: string; patientId?: string } | null;

type CatFilter = NotifCategoryKey | "all";

export default function Notifications() {
  const { notifications, unreadCount, loading, reload, markAsRead, markAllAsRead, deleteNotification, deleteAll } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [prefs, setPrefs] = useState<NotifPrefs>(defaultPrefs());
  const [cat, setCat] = useState<CatFilter>("all");
  const router = useRouter();

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

  // Navigation intelligente selon data.kind, repli par type (cycle / premium).
  const openNotif = useCallback((n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    const d = (n.data ?? null) as NotifData;
    switch (d?.kind) {
      case "post": if (d?.postId) router.push({ pathname: "/(user)/community/[id]", params: { id: d.postId } }); return;
      case "orders": router.push("/(user)/marketplace/orders"); return;
      case "my_appointments": router.push("/(user)/appointments/mine"); return;
      case "doctor_appointments": router.push("/(doctor)/appointments"); return;
      case "patient_chat": if (d?.doctorId) router.push({ pathname: "/(user)/appointments/chat", params: { doctorId: d.doctorId } }); return;
      case "doctor_chat": if (d?.patientId) router.push({ pathname: "/(doctor)/chat", params: { patientId: d.patientId } }); return;
      case "premium": router.push("/(user)/premium"); return;
    }
    const t = n.type ?? "";
    if (t.startsWith("cycle_")) { router.push("/(user)/cycle/calendar"); return; }
    if (t.startsWith("premium_")) { router.push("/(user)/premium"); return; }
    // Système / sans contexte → pas de navigation.
  }, [markAsRead, router]);

  const removeNotif = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    deleteNotification(id);
  }, [deleteNotification]);

  function confirmDeleteAll() {
    Alert.alert("Tout supprimer ?", "Toutes vos notifications seront définitivement supprimées.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Tout supprimer",
        style: "destructive",
        onPress: () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); deleteAll(); },
      },
    ]);
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

  const emptyMessage =
    notifications.length === 0
      ? "Vous n'avez aucune notification pour le moment."
      : cat !== "all"
      ? "Aucune notification dans cette catégorie."
      : "Aucune notification ne correspond à vos préférences.";

  const listHeader = (
    <View>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
          <CatChip label="Toutes" icon="notifications-outline" active={cat === "all"} onPress={() => setCat("all")} />
          {presentCats.map((c) => (
            <CatChip key={c.key} label={c.label} icon={c.icon} active={cat === c.key} onPress={() => setCat(c.key)} />
          ))}
        </ScrollView>
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

function CatChip({ label, icon, active, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Ionicons name={icon} size={13} color={active ? colors.white : colors.textMuted} />
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
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
  chipBar: { flexGrow: 0, flexShrink: 0, marginBottom: spacing.xs },
  chips: { gap: spacing.xs, alignItems: "center", paddingVertical: spacing.xs },
  chip: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.text },
  chipTextActive: { color: colors.white },
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
