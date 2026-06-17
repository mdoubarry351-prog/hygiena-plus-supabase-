import { memo, useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonList } from "@/components/Skeleton";
import { useAuth } from "@/providers/AuthProvider";
import { messagesService, type PatientConversation } from "@/lib/messages-service";
import { formatRelativeTime } from "@/lib/community-service";
import { colors, radius, spacing, typography } from "@/theme";

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export default function Conversations() {
  const { session, role } = useAuth();
  const router = useRouter();
  const [convos, setConvos] = useState<PatientConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    try {
      setConvos(await messagesService.listPatientConversations(session.user.id));
    } catch {
      setConvos([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const openChat = useCallback((c: PatientConversation) => {
    router.push({ pathname: "/(user)/appointments/chat", params: { doctorId: c.doctorId, doctorName: c.doctorName } });
  }, [router]);

  if (role === "doctor") return <Redirect href="/(user)" />;
  if (loading && convos.length === 0) return <Screen><ScreenHeader title="Mes conversations" /><SkeletonList variant="notification" /></Screen>;

  const q = norm(search.trim());
  const list = q
    ? convos.filter((c) => norm(c.doctorName).includes(q) || norm(c.specialty ?? "").includes(q))
    : convos;

  return (
    <Screen>
      <ScreenHeader title="Mes conversations" />
      {convos.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title="Aucune conversation"
          message="Réserve une consultation : tu pourras échanger ici avec ton praticien."
        />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(c) => c.doctorId}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher une conversation…"
              autoCapitalize="none"
              style={styles.search}
            />
          }
          ListEmptyComponent={<EmptyState icon="search-outline" title="Aucun résultat" />}
          renderItem={({ item }) => <ConversationRow convo={item} onPress={openChat} />}
          initialNumToRender={10}
          windowSize={10}
          removeClippedSubviews
        />
      )}
    </Screen>
  );
}

const ConversationRow = memo(function ConversationRow({ convo, onPress }: { convo: PatientConversation; onPress: (c: PatientConversation) => void }) {
  const preview = convo.lastContent?.trim() || "Démarrer la consultation";
  const unread = convo.unreadCount > 0;
  return (
    <Card onPress={() => onPress(convo)} haptic accessibilityLabel={`Conversation avec ${convo.doctorName}`} style={styles.row}>
      <Avatar name={convo.doctorName} size={46} />
      <View style={styles.info}>
        <View style={styles.head}>
          <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>{convo.doctorName}</Text>
          {convo.lastAt ? <Text style={styles.time}>{formatRelativeTime(convo.lastAt)}</Text> : null}
        </View>
        {convo.specialty ? <Text style={styles.specialty} numberOfLines={1}>{convo.specialty}</Text> : null}
        <View style={styles.previewRow}>
          <Text style={[styles.preview, !convo.lastContent && styles.previewEmpty, unread && styles.previewUnread]} numberOfLines={1}>{preview}</Text>
          {unread ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{convo.unreadCount > 99 ? "99+" : convo.unreadCount}</Text></View>
          ) : null}
        </View>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  search: { marginBottom: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  info: { flex: 1, gap: 2 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  name: { ...typography.name, flex: 1 },
  nameUnread: { color: colors.primaryDark },
  time: { ...typography.caption, color: colors.textMuted },
  specialty: { ...typography.caption, color: colors.secondary, fontWeight: "600" },
  previewRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  preview: { ...typography.caption, color: colors.textMuted, flex: 1 },
  previewEmpty: { fontStyle: "italic", color: colors.primary },
  previewUnread: { color: colors.text, fontWeight: "700" },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeText: { ...typography.caption, fontSize: 11, color: colors.white, fontWeight: "700" },
});
