import { useEffect, useState, useCallback } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/providers/ToastProvider";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/providers/AuthProvider";
import { adminService } from "@/lib/admin-service";
import { authorDisplayName, formatRelativeTime, type CommunityPostWithAuthor } from "@/lib/community-service";
import { colors, radius, spacing, typography } from "@/theme";

export default function AdminCommunity() {
  const { session } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [posts, setPosts] = useState<CommunityPostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPosts(await adminService.getPosts());
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function confirmDelete(post: CommunityPostWithAuthor) {
    if (!session?.user) return;
    const ok = await confirm({
      title: "Supprimer la publication ?",
      message: "Cette action est définitive (commentaires et likes inclus).",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminService.deletePost(session.user.id, post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      toast.success("Publication supprimée.");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Suppression échouée");
    }
  }

  if (loading && posts.length === 0) return <Loading />;

  return (
    <Screen>
      <AdminHeader title="Communauté" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {posts.length === 0 ? (
          <EmptyState emoji="💬" title="Aucune publication" />
        ) : (
          posts.map((p) => (
            <Card key={p.id} style={styles.card}>
              <View style={styles.head}>
                <View style={styles.info}>
                  <Text style={styles.author}>{authorDisplayName(p.is_anonymous, p.author)}</Text>
                  <Text style={styles.time}>{formatRelativeTime(p.created_at)} · {p.likes_count} like{p.likes_count > 1 ? "s" : ""}</Text>
                </View>
                <Pressable onPress={() => confirmDelete(p)} hitSlop={8} style={styles.trash}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
              <Text style={styles.body} numberOfLines={4}>{p.content}</Text>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  empty: { alignItems: "center" },
  muted: { color: colors.textMuted },
  card: { gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  info: { flex: 1, gap: 2 },
  author: { ...typography.name },
  time: { ...typography.caption, color: colors.textMuted },
  trash: { padding: spacing.xs },
  body: { ...typography.body, color: colors.text, lineHeight: 21 },
});
