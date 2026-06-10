import { useState, useCallback } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Loading } from "@/components/Loading";
import { useCommunity } from "@/hooks/useCommunity";
import {
  authorDisplayName,
  formatRelativeTime,
  type CommunityPostWithAuthor,
} from "@/lib/community-service";
import { colors, radius, spacing, typography } from "@/theme";

export default function CommunityHome() {
  const { posts, likedIds, loading, reload, toggleLike } = useCommunity();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  async function onRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  if (loading && posts.length === 0) return <Loading />;

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={typography.h2}>Communauté</Text>
        <Pressable
          onPress={() => router.push("/(user)/community/new")}
          hitSlop={10}
          style={styles.newBtn}
        >
          <Ionicons name="create-outline" size={18} color={colors.white} />
          <Text style={styles.newBtnText}>Publier</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {posts.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={typography.h3}>Aucune publication</Text>
            <Text style={[typography.body, styles.muted]}>
              Soyez la première à partager quelque chose avec la communauté.
            </Text>
          </Card>
        ) : (
          posts.map((post) => (
            <PostRow
              key={post.id}
              post={post}
              liked={likedIds.has(post.id)}
              onPress={() => router.push(`/(user)/community/${post.id}`)}
              onLike={() => toggleLike(post.id)}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function PostRow({
  post,
  liked,
  onPress,
  onLike,
}: {
  post: CommunityPostWithAuthor;
  liked: boolean;
  onPress: () => void;
  onLike: () => void;
}) {
  const name = authorDisplayName(post.is_anonymous, post.author);
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.post}>
        <View style={styles.postHead}>
          <View style={styles.avatar}>
            <Ionicons
              name={post.is_anonymous ? "person-outline" : "person"}
              size={18}
              color={colors.primary}
            />
          </View>
          <View style={styles.headInfo}>
            <Text style={styles.author}>{name}</Text>
            <Text style={styles.time}>{formatRelativeTime(post.created_at)}</Text>
          </View>
        </View>

        <Text style={styles.body} numberOfLines={5}>{post.content}</Text>

        <View style={styles.postFoot}>
          <Pressable onPress={onLike} hitSlop={8} style={styles.likeBtn}>
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={20}
              color={liked ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.likeCount, liked && styles.likeCountActive]}>
              {post.likes_count}
            </Text>
          </Pressable>
          <View style={styles.commentHint}>
            <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
            <Text style={styles.commentHintText}>Commenter</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.lg },
  newBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  newBtnText: { color: colors.white, fontSize: 14, fontWeight: "600" },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  empty: { gap: spacing.sm, alignItems: "center" },
  emptyEmoji: { fontSize: 34 },
  muted: { color: colors.textMuted },
  post: { gap: spacing.sm },
  postHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: {
    width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  headInfo: { flex: 1 },
  author: { ...typography.body, fontWeight: "600" },
  time: { ...typography.caption, color: colors.textMuted },
  body: { ...typography.body, color: colors.text, lineHeight: 21 },
  postFoot: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.xs },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  likeCount: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  likeCountActive: { color: colors.primary },
  commentHint: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  commentHintText: { ...typography.caption, color: colors.textMuted },
});
