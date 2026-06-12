import { useState, useCallback } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Loading } from "@/components/Loading";
import { useCommunity } from "@/hooks/useCommunity";
import { useAuth } from "@/providers/AuthProvider";
import {
  authorDisplayName,
  formatRelativeTime,
  communityService,
  COMMUNITY_CATEGORIES,
  type CommunityPostWithAuthor,
} from "@/lib/community-service";
import { VerifiedDoctorBadge, CategoryTag } from "@/components/CommunityBadges";
import { colors, radius, spacing, typography } from "@/theme";

export default function CommunityHome() {
  const { posts, likedIds, loading, reload, toggleLike } = useCommunity();
  const { session } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("all");
  const meId = session?.user?.id;

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  // Bloque l'auteur d'une publication → ses contenus disparaissent du fil.
  function blockAuthor(userId: string) {
    Alert.alert("Bloquer cet utilisateur ?", "Vous ne verrez plus les publications de cette personne.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Bloquer",
        style: "destructive",
        onPress: async () => {
          try {
            await communityService.blockUser(userId);
            await reload();
          } catch (e) {
            Alert.alert("Erreur", e instanceof Error ? e.message : "Action impossible");
          }
        },
      },
    ]);
  }

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

      {/* Filtres par catégorie */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
        {["all", ...COMMUNITY_CATEGORIES].map((c) => {
          const active = activeCat === c;
          return (
            <Pressable key={c} onPress={() => setActiveCat(c)} style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{c === "all" ? "Toutes" : c}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {(() => {
          const visible = activeCat === "all" ? posts : posts.filter((p) => p.category === activeCat);
          return visible.length === 0 ? (
            <EmptyState
              emoji="💬"
              title="Aucune publication"
              message={activeCat === "all" ? "Soyez la première à partager quelque chose avec la communauté." : "Aucune publication dans cette catégorie."}
            />
          ) : (
            visible.map((post) => (
              <PostRow
                key={post.id}
                post={post}
                liked={likedIds.has(post.id)}
                canBlock={!post.is_anonymous && !!post.user_id && post.user_id !== meId}
                onBlock={() => post.user_id && blockAuthor(post.user_id)}
                onPress={() => router.push(`/(user)/community/${post.id}`)}
                onLike={() => toggleLike(post.id)}
              />
            ))
          );
        })()}
      </ScrollView>
    </Screen>
  );
}

function PostRow({
  post,
  liked,
  canBlock,
  onBlock,
  onPress,
  onLike,
}: {
  post: CommunityPostWithAuthor;
  liked: boolean;
  canBlock: boolean;
  onBlock: () => void;
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
            <View style={styles.authorRow}>
              <Text style={styles.author}>{name}</Text>
              {!post.is_anonymous && post.author?.isVerifiedDoctor ? <VerifiedDoctorBadge /> : null}
            </View>
            <Text style={styles.time}>{formatRelativeTime(post.created_at)}</Text>
          </View>
          <CategoryTag category={post.category} />
          {canBlock ? (
            <Pressable onPress={onBlock} hitSlop={10} style={styles.blockBtn}>
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
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
          <View style={styles.likeBtn}>
            <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
            <Text style={styles.likeCount}>{post.comments_count}</Text>
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
  authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  blockBtn: { padding: spacing.xs },
  author: { ...typography.name },
  time: { ...typography.caption, color: colors.textMuted },
  filterChips: { gap: spacing.xs, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { ...typography.caption, fontWeight: "700", color: colors.text },
  filterChipTextActive: { color: colors.white },
  body: { ...typography.body, color: colors.text, lineHeight: 21 },
  postFoot: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.xs },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  likeCount: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  likeCountActive: { color: colors.primary },
  commentHint: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  commentHintText: { ...typography.caption, color: colors.textMuted },
});
