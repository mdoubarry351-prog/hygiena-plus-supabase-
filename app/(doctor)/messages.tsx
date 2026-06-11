import { useEffect, useState, useCallback } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Loading } from "@/components/Loading";
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

  return (
    <Screen>
      <View style={styles.topBar}><Text style={typography.h2}>Messages</Text></View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.note}>Conseils en ligne avec vos patientes Premium.</Text>

        {convos.length === 0 ? (
          <EmptyState
            icon="chatbubbles-outline"
            title="Aucun message"
            message="Les conseils de vos patientes apparaîtront ici."
          />
        ) : (
          convos.map((c) => (
            <Pressable
              key={c.patientId}
              onPress={() => router.push({ pathname: "/(doctor)/chat", params: { patientId: c.patientId, patientName: c.patientName } })}
            >
              <Card style={styles.row}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{c.patientName.charAt(0).toUpperCase()}</Text></View>
                <View style={styles.info}>
                  <View style={styles.head}>
                    <Text style={styles.name} numberOfLines={1}>{c.patientName}</Text>
                    <Text style={styles.time}>{formatRelativeTime(c.lastAt)}</Text>
                  </View>
                  <Text style={styles.last} numberOfLines={1}>{c.lastContent}</Text>
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", paddingTop: spacing.lg },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  note: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { ...typography.name, color: colors.primaryDark },
  info: { flex: 1, gap: 2 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  name: { ...typography.name, flex: 1 },
  time: { ...typography.caption, color: colors.textMuted },
  last: { ...typography.caption, color: colors.textMuted },
});
