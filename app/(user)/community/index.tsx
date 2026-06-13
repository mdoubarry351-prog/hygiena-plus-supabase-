import { useState, useCallback } from "react";
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";
import { Loading } from "@/components/Loading";
import { useCommunity } from "@/hooks/useCommunity";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useAuth } from "@/providers/AuthProvider";
import {
  authorDisplayName,
  formatRelativeTime,
  communityService,
  COMMUNITY_CATEGORIES,
  categoryLabel,
  type CommunityPostWithAuthor,
} from "@/lib/community-service";
import { VerifiedDoctorBadge, CategoryTag } from "@/components/CommunityBadges";
import { colors, radius, spacing, typography } from "@/theme";

// Minuscules + suppression des accents pour une recherche tolérante.
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export default function CommunityHome() {
  const { posts, likedIds, loading, loadingMore, hasMore, reload, loadMore, toggleLike } = useCommunity();
  const { savedIds, toggle: toggleSave } = useBookmarks();
  const { session } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<"recent" | "trending">("recent");
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

  // Charge la page suivante quand on approche du bas.
  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 220) loadMore();
  }

  if (loading && posts.length === 0) return <Loading />;

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={typography.h2}>Communauté</Text>
        <View style={styles.topActions}>
          <Pressable onPress={() => router.push("/(user)/community/saved")} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Publications enregistrées">
            <Ionicons name="bookmark-outline" size={22} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/(user)/community/new")}
            hitSlop={10}
            style={styles.newBtn}
          >
            <Ionicons name="create-outline" size={18} color={colors.white} />
            <Text style={styles.newBtnText}>Publier</Text>
          </Pressable>
        </View>
      </View>

      {/* Recherche */}
      <View style={styles.searchRow}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher une publication…"
          autoCapitalize="none"
          style={styles.searchInput}
        />
      </View>

      {/* Tri : Récents / Tendances */}
      <View style={styles.segment}>
        <Pressable onPress={() => setSortMode("recent")} style={[styles.segBtn, sortMode === "recent" && styles.segBtnActive]}>
          <Ionicons name="time-outline" size={15} color={sortMode === "recent" ? colors.white : colors.textMuted} />
          <Text style={[styles.segText, sortMode === "recent" && styles.segTextActive]}>Récents</Text>
        </Pressable>
        <Pressable onPress={() => setSortMode("trending")} style={[styles.segBtn, sortMode === "trending" && styles.segBtnActive]}>
          <Ionicons name="flame-outline" size={15} color={sortMode === "trending" ? colors.white : colors.accent} />
          <Text style={[styles.segText, sortMode === "trending" && styles.segTextActive]}>Tendances</Text>
        </Pressable>
      </View>

      {/* Filtres par catégorie */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterChips}
      >
        {["all", ...COMMUNITY_CATEGORIES].map((c) => {
          const active = activeCat === c;
          return (
            <Pressable key={c} onPress={() => setActiveCat(c)} style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{c === "all" ? "✨ Toutes" : categoryLabel(c)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onScroll={handleScroll}
        scrollEventThrottle={400}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {(() => {
          // Catégorie + recherche (contenu) combinées, puis tri.
          const q = norm(search.trim());
          let visible = posts
            .filter((p) => activeCat === "all" || p.category === activeCat)
            .filter((p) => !q || norm(p.content).includes(q));
          if (sortMode === "trending") {
            visible = [...visible].sort(
              (a, b) => (b.likes_count + b.comments_count) - (a.likes_count + a.comments_count)
            );
          }
          const filtering = !!q || activeCat !== "all";

          if (visible.length === 0) {
            return (
              <EmptyState
                emoji="💬"
                title={filtering ? "Aucune publication trouvée" : "Aucune publication"}
                message={filtering ? "Essayez un autre mot-clé ou une autre catégorie." : "Soyez la première à partager quelque chose avec la communauté."}
              />
            );
          }
          return (
            <>
              <Text style={styles.count}>{visible.length} publication{visible.length > 1 ? "s" : ""}</Text>
              {visible.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  liked={likedIds.has(post.id)}
                  saved={savedIds.has(post.id)}
                  onToggleSave={() => toggleSave(post.id)}
                  canBlock={!post.is_anonymous && !!post.user_id && post.user_id !== meId}
                  onBlock={() => post.user_id && blockAuthor(post.user_id)}
                  onPress={() => router.push(`/(user)/community/${post.id}`)}
                  onLike={() => toggleLike(post.id)}
                />
              ))}
            </>
          );
        })()}

        {hasMore ? (
          <View style={styles.footer}>
            {loadingMore ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Pressable onPress={loadMore} style={styles.loadMore}>
                <Text style={styles.loadMoreText}>Charger plus</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function PostRow({
  post,
  liked,
  saved,
  onToggleSave,
  canBlock,
  onBlock,
  onPress,
  onLike,
}: {
  post: CommunityPostWithAuthor;
  liked: boolean;
  saved: boolean;
  onToggleSave: () => void;
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
            <Pressable onPress={onBlock} hitSlop={10} style={styles.blockBtn} accessibilityRole="button" accessibilityLabel="Bloquer cet utilisateur">
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.body} numberOfLines={5}>{post.content}</Text>

        {post.image_url ? (
          <Image source={{ uri: post.image_url }} style={styles.postImage} resizeMode="cover" />
        ) : null}

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
          <Pressable onPress={onToggleSave} hitSlop={8} style={styles.bookmarkBtn} accessibilityRole="button" accessibilityLabel={saved ? "Retirer des enregistrements" : "Enregistrer la publication"}>
            <Ionicons
              name={saved ? "bookmark" : "bookmark-outline"}
              size={20}
              color={saved ? colors.primary : colors.textMuted}
            />
          </Pressable>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.lg },
  topActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconBtn: { padding: spacing.xs },
  bookmarkBtn: { marginLeft: "auto", padding: spacing.xs },
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
  // La ScrollView ne doit pas s'étirer verticalement (sinon les chips se déforment).
  searchRow: { paddingTop: spacing.sm },
  searchInput: { marginBottom: 0 },
  segment: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  segBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  segBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontSize: 13, fontWeight: "700", color: colors.text },
  segTextActive: { color: colors.white },
  count: { ...typography.caption, color: colors.textMuted, fontWeight: "700" },
  footer: { alignItems: "center", paddingVertical: spacing.md },
  loadMore: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.primary },
  loadMoreText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  filterBar: { flexGrow: 0, flexShrink: 0 },
  filterChips: { gap: spacing.xs, alignItems: "center", paddingVertical: spacing.sm },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 13, fontWeight: "700", color: colors.text },
  filterChipTextActive: { color: colors.white },
  body: { ...typography.body, color: colors.text, lineHeight: 21 },
  postImage: { width: "100%", height: 200, borderRadius: radius.md, backgroundColor: colors.surface },
  postFoot: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.xs },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  likeCount: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  likeCountActive: { color: colors.primary },
  commentHint: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  commentHintText: { ...typography.caption, color: colors.textMuted },
});
