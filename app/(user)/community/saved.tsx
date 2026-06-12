import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Loading } from "@/components/Loading";
import { VerifiedDoctorBadge, CategoryTag } from "@/components/CommunityBadges";
import { useBookmarks } from "@/hooks/useBookmarks";
import {
  communityService,
  authorDisplayName,
  formatRelativeTime,
  type CommunityPostWithAuthor,
} from "@/lib/community-service";
import { colors, radius, spacing, typography } from "@/theme";

export default function SavedPosts() {
  const router = useRouter();
  const { toggle } = useBookmarks();
  const [posts, setPosts] = useState<CommunityPostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setPosts(await communityService.getBookmarkedPosts());
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // Retrait optimiste de la liste.
  async function unsave(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    await toggle(id); // post actuellement enregistré → retire
  }

  if (loading && posts.length === 0) return <Loading />;

  return (
    <Screen>
      <ScreenHeader title="Publications enregistrées" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {posts.length === 0 ? (
          <EmptyState
            icon="bookmark-outline"
            title="Aucune publication enregistrée"
            message="Touchez le signet sur une publication pour la retrouver ici."
          />
        ) : (
          posts.map((post) => {
            const name = authorDisplayName(post.is_anonymous, post.author);
            return (
              <Pressable key={post.id} onPress={() => router.push(`/(user)/community/${post.id}`)}>
                <Card style={styles.post}>
                  <View style={styles.postHead}>
                    <View style={styles.avatar}>
                      <Ionicons name={post.is_anonymous ? "person-outline" : "person"} size={18} color={colors.primary} />
                    </View>
                    <View style={styles.headInfo}>
                      <View style={styles.authorRow}>
                        <Text style={styles.author}>{name}</Text>
                        {!post.is_anonymous && post.author?.isVerifiedDoctor ? <VerifiedDoctorBadge /> : null}
                      </View>
                      <Text style={styles.time}>{formatRelativeTime(post.created_at)}</Text>
                    </View>
                    <CategoryTag category={post.category} />
                  </View>

                  <Text style={styles.body} numberOfLines={5}>{post.content}</Text>

                  <View style={styles.postFoot}>
                    <View style={styles.metric}>
                      <Ionicons name="heart-outline" size={18} color={colors.textMuted} />
                      <Text style={styles.metricText}>{post.likes_count}</Text>
                    </View>
                    <View style={styles.metric}>
                      <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
                      <Text style={styles.metricText}>{post.comments_count}</Text>
                    </View>
                    <Pressable onPress={() => unsave(post.id)} hitSlop={8} style={styles.bookmarkBtn}>
                      <Ionicons name="bookmark" size={20} color={colors.primary} />
                    </Pressable>
                  </View>
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  post: { gap: spacing.sm },
  postHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  headInfo: { flex: 1 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  author: { ...typography.name },
  time: { ...typography.caption, color: colors.textMuted },
  body: { ...typography.body, color: colors.text, lineHeight: 21 },
  postFoot: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.xs },
  metric: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metricText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  bookmarkBtn: { marginLeft: "auto", padding: spacing.xs },
});
