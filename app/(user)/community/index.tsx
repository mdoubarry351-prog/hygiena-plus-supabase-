import { memo, useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonList } from "@/components/Skeleton";
import { ActionSheet, type ActionSheetOption } from "@/components/ActionSheet";
import { useCommunity } from "@/hooks/useCommunity";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useAuth } from "@/providers/AuthProvider";
import {
  authorDisplayName,
  formatRelativeTime,
  wasEdited,
  communityService,
  COMMUNITY_CATEGORIES,
  REPORT_REASONS,
  categoryLabel,
  type CommunityPostWithAuthor,
} from "@/lib/community-service";
import { VerifiedDoctorBadge, CategoryTag } from "@/components/CommunityBadges";
import { PostImages } from "@/components/PostImages";
import { Avatar } from "@/components/Avatar";
import { LikeButton } from "@/components/LikeButton";
import { hapticWarning } from "@/lib/haptics";
import { useToast } from "@/providers/ToastProvider";
import { APP_DOWNLOAD_URL } from "@/lib/app-config";
import { colors, radius, spacing, typography } from "@/theme";

export default function CommunityHome() {
  const [refreshing, setRefreshing] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<"recent" | "trending">("recent");

  // Filtres appliqués CÔTÉ SERVEUR (recherche + catégorie + tri).
  const { posts, likedIds, loading, loadingMore, hasMore, reload, loadMore, toggleLike } = useCommunity({
    search,
    category: activeCat === "all" ? null : activeCat,
    sort: sortMode === "trending" ? "trending" : "recents",
  });
  const { savedIds, toggle: toggleSave } = useBookmarks();
  const { session } = useAuth();
  const router = useRouter();
  const meId = session?.user?.id;
  const toast = useToast();
  const isFiltering = !!search.trim() || activeCat !== "all";

  // Menu ⋯ en action sheet (une seule instance pour tout le fil).
  const [sheet, setSheet] = useState<{ title?: string; options: ActionSheetOption[] } | null>(null);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  // Partage natif d'une publication + lien de téléchargement de l'app.
  async function sharePost(post: CommunityPostWithAuthor) {
    try {
      await Share.share({ message: `${post.content}\n\nVu sur Hygiena+ 🌸 Télécharge l'app : ${APP_DOWNLOAD_URL}` });
    } catch {
      // partage annulé
    }
  }

  // Construit le menu ⋯ : MON post → Modifier/Partager/Supprimer ; autre → Partager/Signaler (+ Bloquer).
  function openPostMenu(post: CommunityPostWithAuthor) {
    const isMine = !!post.user_id && post.user_id === meId;
    const canBlock = !post.is_anonymous && !!post.user_id && post.user_id !== meId;
    const options: ActionSheetOption[] = isMine
      ? [
          { label: "Modifier", icon: "create-outline", onPress: () => router.push({ pathname: "/(user)/community/new", params: { id: post.id } }) },
          { label: "Partager", icon: "share-social-outline", onPress: () => sharePost(post) },
          { label: "Supprimer", icon: "trash-outline", destructive: true, onPress: () => deleteMyPost(post.id) },
        ]
      : [
          { label: "Partager", icon: "share-social-outline", onPress: () => sharePost(post) },
          { label: "Signaler", icon: "flag-outline", onPress: () => reportPost(post) },
          ...(canBlock ? [{ label: "Bloquer cet utilisateur", icon: "ban-outline" as const, destructive: true, onPress: () => post.user_id && blockAuthor(post.user_id) }] : []),
        ];
    setSheet({ title: isMine ? "Ma publication" : "Publication", options });
  }

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

  // Signale la publication d'un autre : choix de la raison puis insertion.
  function reportPost(post: CommunityPostWithAuthor) {
    const buttons = REPORT_REASONS.map((r) => ({
      text: r,
      onPress: async () => {
        try {
          await communityService.reportPost(post.id, post.user_id ?? null, r);
          toast.success("Ce contenu a été signalé à la modération.");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Signalement impossible");
        }
      },
    }));
    Alert.alert("Signaler la publication", "Pour quelle raison ?", [...buttons, { text: "Annuler", style: "cancel" }]);
  }

  // Supprime MA propre publication (confirmation + haptique).
  function deleteMyPost(postId: string) {
    Alert.alert("Supprimer la publication ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          hapticWarning();
          try {
            await communityService.deletePost(postId);
            await reload();
          } catch (e) {
            Alert.alert("Erreur", e instanceof Error ? e.message : "Suppression échouée");
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

  // ---- Callbacks de ligne STABLES (via refs) : permettent de mémoïser PostRow
  // pour qu'un like/un save ne re-rende QUE la carte concernée, pas tout le fil.
  const toggleLikeRef = useRef(toggleLike); toggleLikeRef.current = toggleLike;
  const toggleSaveRef = useRef(toggleSave); toggleSaveRef.current = toggleSave;
  const openPostMenuRef = useRef(openPostMenu); openPostMenuRef.current = openPostMenu;

  const sharePostRef = useRef(sharePost); sharePostRef.current = sharePost;

  const onLike = useCallback((id: string) => toggleLikeRef.current(id), []);
  const onToggleSave = useCallback((id: string) => toggleSaveRef.current(id), []);
  const onMenu = useCallback((post: CommunityPostWithAuthor) => openPostMenuRef.current(post), []);
  const onShare = useCallback((post: CommunityPostWithAuthor) => sharePostRef.current(post), []);
  const onOpen = useCallback((id: string) => router.push(`/(user)/community/${id}`), [router]);
  const onOpenComments = useCallback((id: string) => router.push(`/(user)/community/${id}?focus=comments`), [router]);

  const renderItem = useCallback(
    ({ item }: { item: CommunityPostWithAuthor }) => (
      <PostRow
        post={item}
        liked={likedIds.has(item.id)}
        saved={savedIds.has(item.id)}
        onPress={onOpen}
        onOpenComments={onOpenComments}
        onLike={onLike}
        onToggleSave={onToggleSave}
        onMenu={onMenu}
        onShare={onShare}
      />
    ),
    [likedIds, savedIds, onOpen, onOpenComments, onLike, onToggleSave, onMenu, onShare]
  );

  // En-tête de liste : titre + actions + recherche + tri + filtres + compteur.
  // Rendu comme élément (et non fonction recréée) pour que le champ de
  // recherche conserve le focus à chaque frappe.
  const header = (
    <View>
      <View style={styles.topBar}>
        <Text style={typography.h2}>Communauté</Text>
        <View style={styles.topActions}>
          <Pressable onPress={() => router.push("/(user)/community/rules")} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Règles de la communauté">
            <Ionicons name="information-circle-outline" size={23} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => router.push("/(user)/community/saved")} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Publications enregistrées">
            <Ionicons name="bookmark-outline" size={22} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => router.push("/(user)/community/new")} hitSlop={10} style={styles.newBtn}>
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
        keyboardShouldPersistTaps="handled"
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

      {posts.length > 0 ? (
        <Text style={styles.count}>{posts.length} publication{posts.length > 1 ? "s" : ""}</Text>
      ) : null}
    </View>
  );

  if (loading && posts.length === 0) return <SkeletonList variant="post" />;

  return (
    <Screen>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        extraData={likedIds}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            emoji="💬"
            title={isFiltering ? "Aucune publication trouvée" : "Aucune publication"}
            message={isFiltering ? "Essayez un autre mot-clé ou une autre catégorie." : "Soyez la première à partager quelque chose avec la communauté."}
          />
        }
        ListFooterComponent={
          hasMore ? (
            <View style={styles.footer}>
              {loadingMore ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Pressable onPress={loadMore} style={styles.loadMore}>
                  <Text style={styles.loadMoreText}>Charger plus</Text>
                </Pressable>
              )}
            </View>
          ) : null
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onEndReached={() => loadMore()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        // Réglages de virtualisation pour un défilement fluide sur longues listes.
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={11}
        removeClippedSubviews
      />

      <ActionSheet
        visible={!!sheet}
        title={sheet?.title}
        options={sheet?.options ?? []}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}

const PostRow = memo(function PostRow({
  post,
  liked,
  saved,
  onToggleSave,
  onMenu,
  onPress,
  onOpenComments,
  onLike,
  onShare,
}: {
  post: CommunityPostWithAuthor;
  liked: boolean;
  saved: boolean;
  onToggleSave: (id: string) => void;
  onMenu: (post: CommunityPostWithAuthor) => void;
  onPress: (id: string) => void;
  onOpenComments: (id: string) => void;
  onLike: (id: string) => void;
  onShare: (post: CommunityPostWithAuthor) => void;
}) {
  const name = authorDisplayName(post.is_anonymous, post.author);
  const edited = wasEdited(post.created_at, post.updated_at);

  return (
    <Card onPress={() => onPress(post.id)} accessibilityLabel="Ouvrir la publication" style={styles.post}>
        <View style={styles.postHead}>
          <Avatar url={post.author?.avatar_url} isAnonymous={post.is_anonymous} size={38} />
          <View style={styles.headInfo}>
            <View style={styles.authorRow}>
              <Text style={styles.author}>{name}</Text>
              {!post.is_anonymous && post.author?.isVerifiedDoctor ? <VerifiedDoctorBadge /> : null}
            </View>
            <Text style={styles.time}>{formatRelativeTime(post.created_at)}{edited ? " · modifié" : ""}</Text>
          </View>
          <CategoryTag category={post.category} />
          <Pressable onPress={() => onMenu(post)} hitSlop={10} style={styles.blockBtn} accessibilityRole="button" accessibilityLabel="Options de la publication">
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.body} numberOfLines={5}>{post.content}</Text>

        <PostImages imageUrls={post.image_urls} imageUrl={post.image_url} />

        <View style={styles.postFoot}>
          <LikeButton liked={liked} count={post.likes_count} onPress={() => onLike(post.id)} size={20} />
          <Pressable onPress={() => onOpenComments(post.id)} hitSlop={8} style={styles.likeBtn} accessibilityRole="button" accessibilityLabel="Voir les commentaires">
            <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
            <Text style={styles.likeCount}>{post.comments_count}</Text>
          </Pressable>
          <Pressable onPress={() => onShare(post)} hitSlop={8} style={styles.likeBtn} accessibilityRole="button" accessibilityLabel="Partager la publication">
            <Ionicons name="share-social-outline" size={19} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={() => onToggleSave(post.id)} hitSlop={8} style={styles.bookmarkBtn} accessibilityRole="button" accessibilityLabel={saved ? "Retirer des enregistrements" : "Enregistrer la publication"}>
            <Ionicons
              name={saved ? "bookmark" : "bookmark-outline"}
              size={20}
              color={saved ? colors.primary : colors.textMuted}
            />
          </Pressable>
        </View>
    </Card>
  );
});

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
  muted: { color: colors.textMuted },
  post: { gap: spacing.sm },
  postHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
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
  count: { ...typography.caption, color: colors.textMuted, fontWeight: "700", marginTop: spacing.xs },
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
  postFoot: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.xs },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  likeCount: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
});
