import { useEffect, useState, useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";
import { Loading } from "@/components/Loading";
import { FadeInView } from "@/components/FadeInView";
import { useMyDoctor } from "@/hooks/useMyDoctor";
import { messagesService, type DoctorConversation } from "@/lib/messages-service";
import { formatRelativeTime } from "@/lib/community-service";
import { colors, radius, spacing, typography } from "@/theme";

export default function DoctorMessages() {
  const { doctor, loading: loadingDoctor } = useMyDoctor();
  const router = useRouter();
  const [convos, setConvos] = useState<DoctorConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!doctor) return;
    setLoading(true);
    try {
      setConvos(await messagesService.getDoctorConversations(doctor.id));
    } catch {
      setConvos([]);
    } finally {
      setLoading(false);
    }
  }, [doctor]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loadingDoctor || (loading && convos.length === 0)) return <Loading />;

  const q = search.trim().toLowerCase();
  const filtered = q ? convos.filter((c) => c.patientName.toLowerCase().includes(q)) : convos;

  return (
    <Screen>
      <View style={styles.topBar}><Text style={typography.h2}>Messages</Text></View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.note}>Salle de consultation avec vos patientes.</Text>

        {convos.length === 0 ? (
          <EmptyState
            icon="chatbubbles-outline"
            title="Aucun message"
            message="Les échanges avec vos patientes apparaîtront ici."
          />
        ) : (
          <>
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher une patiente…"
              autoCapitalize="none"
              style={styles.search}
            />
            {filtered.length === 0 ? (
              <EmptyState icon="search-outline" title="Aucun résultat" />
            ) : (
              filtered.map((c, i) => {
                const unread = c.unreadCount > 0;
                return (
                  <FadeInView key={c.patientId} fill={false} delay={Math.min(i, 6) * 50}>
                    <Card
                      onPress={() => router.push({ pathname: "/(doctor)/chat", params: { patientId: c.patientId, patientName: c.patientName } })}
                      haptic
                      accessibilityLabel={`Conversation avec ${c.patientName}`}
                      style={styles.row}
                    >
                      <Avatar name={c.patientName} size={44} />
                      <View style={styles.info}>
                        <View style={styles.head}>
                          <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>{c.patientName}</Text>
                          <Text style={styles.time}>{formatRelativeTime(c.lastAt)}</Text>
                        </View>
                        <View style={styles.lastRow}>
                          <Text style={[styles.last, unread && styles.lastUnread]} numberOfLines={1}>{c.lastContent}</Text>
                          {unread ? (
                            <View style={styles.badge}><Text style={styles.badgeText}>{c.unreadCount > 99 ? "99+" : c.unreadCount}</Text></View>
                          ) : null}
                        </View>
                      </View>
                    </Card>
                  </FadeInView>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", paddingTop: spacing.lg },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  note: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  search: { marginBottom: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  nameUnread: { color: colors.primaryDark },
  lastRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  lastUnread: { color: colors.text, fontWeight: "700" },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeText: { ...typography.caption, fontSize: 11, color: colors.white, fontWeight: "700" },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { ...typography.name, color: colors.primaryDark },
  info: { flex: 1, gap: 2 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  name: { ...typography.name, flex: 1 },
  time: { ...typography.caption, color: colors.textMuted },
  last: { ...typography.caption, color: colors.textMuted, flex: 1 },
});
