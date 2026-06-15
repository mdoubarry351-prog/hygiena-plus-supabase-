import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View, type ListRenderItemInfo } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";
import { OfflineBanner } from "@/components/OfflineBanner";
import { AppImage } from "@/components/AppImage";
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
  type DoctorSearchResult,
} from "@/lib/community-service";
import { VerifiedDoctorBadge, CategoryTag } from "@/components/CommunityBadges";
import { PostImages } from "@/components/PostImages";
import { HeartButton } from "@/components/HeartButton";
import { hapticWarning } from "@/lib/haptics";
import { useToast } from "@/providers/ToastProvider";
import { APP_DOWNLOAD_URL } from "@/lib/app-config";
import { colors, radius, spacing, typography } from "@/theme";

export default function CommunityHome() {
  const [refreshing, setRefreshing] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("all");
  const [doctorsOnly, setDoctorsOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<"recent" | "trending">("recent");
  // Médecins correspondant à la recherche (section en tête du fil).
  const [doctorResults, setDoctorResults] = useState<DoctorSearchResult[]>([]);

  // Filtres appliqués CÔTÉ SERVEUR (recherche + catégorie + tri + filtre médecins).
  const { posts, likedIds, loading, loadingMore, hasMore, error, reload, loadMore, toggleLike } = useCommunity({
    search,
    category: activeCat === "all" ? null : activeCat,
    sort: sortMode === "trending" ? "trending" : "recents",
    doctorsOnly,
  });
  const { savedIds, toggle: toggleSave } = useBookmarks();
  const { session } = useAuth();
  const router = useRouter();
  const meId = session?.user?.id;
  const toast = useToast();
  const isSearching = !!search.trim();
  const isFiltering = isSearching || activeCat !== "all" || doctorsOnly;

  // Recherche de médecins (identités publiques) — section en tête du fil quand on
  // recherche. Débounce ~350 ms, alignée sur le rechargement des publications.
  useEffect(() => {
    const term = search.trim();
    if (!term) { setDoctorResults([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const docs = await communityService.searchDoctors(term);
        if (alive) setDoctorResults(docs);
      } catch {
        if (alive) setDoctorResults([]);
      }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [search]);

  const onOpenDoctor = useCallback((id: string) => router.push(`/(user)/appointments/${id}`), [router]);

  // Menu ⋯ en action sheet (une seule instance pour tout le fil).
  const [sheet, setSheet] = useState<{ title?: string; options: ActionSheetOption[] } | null>(null);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  // Partage natif d'une publication + lien de téléchargement de l'app.
  const sharePost = useCallback(async (post: CommunityPostWithAuthor) => {
    try {
      await Share.share({ message: `${post.content}\n\nVu sur Hygiena+ 🌸 Télécharge l'app : ${APP_DOWNLOAD_URL}` });
    } catch {
      // partage annulé
    }
  }, []);

  // Bloque l'auteur d'une publication → ses contenus disparaissent du fil.
  const blockAuthor = useCallback((userId: string) => {
    Alert.alert("Bloquer cet utilisateur ?", "Tu ne verras plus les publications de cette personne.", [
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
  }, [reload]);

  // Signale la publication d'un autre : choix de la raison puis insertion.
  const reportPost = useCallback((post: CommunityPostWithAuthor) => {
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
  }, [toast]);

  // Supprime MA propre publication (confirmation + haptique).
  const deleteMyPost = useCallback((postId: string) => {
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
  }, [reload]);

  // Construit le menu ⋯ : MON post → Modifier/Partager/Supprimer ; autre → Partager/Signaler (+ Bloquer).
  const openPostMenu = useCallback((post: CommunityPostWithAuthor) => {
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
  }, [meId, router, sharePost, reportPost, blockAuthor, deleteMyPost]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  // Pagination via FlatList (remplace l'écoute onScroll).
  const onEndReached = useCallback(() => {
    if (hasMore && !loadingMore) loadMore();
  }, [hasMore, loadingMore, loadMore]);

  // Handlers stables (id-based) pour mémoïser les cartes.
  const onPressPost = useCallback((id: string) => router.push(`/(user)/community/${id}`), [router]);
  const onOpenCommentsPost = useCallback((id: string) => router.push(`/(user)/community/${id}?focus=comments`), [router]);
  const onLikePost = useCallback((id: string) => toggleLike(id), [toggleLike]);
  const onSavePost = useCallback((id: string) => toggleSave(id), [toggleSave]);

  // Déclenche un re-render des items quand les likes/signets changent.
  const extra = useMemo(() => ({ likedIds, savedIds }), [likedIds, savedIds]);

  const keyExtractor = useCallback((item: CommunityPostWithAuthor) => item.id, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<CommunityPostWithAuthor>) => (
      <PostRow
        post={item}
        liked={likedIds.has(item.id)}
        saved={savedIds.has(item.id)}
        onToggleSave={onSavePost}
        onMenu={openPostMenu}
        onPress={onPressPost}
        onOpenComments={onOpenCommentsPost}
        onLike={onLikePost}
      />
    ),
    [likedIds, savedIds, onSavePost, openPostMenu, onPressPost, onOpenCommentsPost, onLikePost]
  );

  if (loading && posts.length === 0) return <SkeletonList variant="post" />;

  // Échec réseau SANS aucune donnée : vrai état d'erreur (≠ « aucune publication »).
  if (error && posts.length === 0) {
    return (
      <Screen>
        <View style={styles.topBar}>
          <Text style={typography.h2}>Communauté</Text>
        </View>
        <EmptyState
          icon="cloud-offline-outline"
          title="Connexion impossible"
          message="Vérifie ta connexion, puis réessaie."
          actionLabel="Réessayer"
          onAction={reload}
        />
      </Screen>
    );
  }

  // En-tête du fil (barre + recherche + tri + chips + compteur) — défile avec la liste.
  const listHeader = (
    <View>
      {/* Données déjà chargées mais le rafraîchissement a échoué → hors-ligne. */}
      {error ? <OfflineBanner cachedAt={null} /> : null}

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

      <View style={styles.searchRow}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher une publication…"
          autoCapitalize="none"
          style={styles.searchInput}
        />
      </View>

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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterChips}>
        <Pressable onPress={() => setActiveCat("all")} style={[styles.filterChip, activeCat === "all" && styles.filterChipActive]}>
          <Text style={[styles.filterChipText, activeCat === "all" && styles.filterChipTextActive]}>✨ Toutes</Text>
        </Pressable>
        <Pressable onPress={() => setDoctorsOnly((v) => !v)} style={[styles.filterChip, doctorsOnly && styles.filterChipActive]}>
          <Text style={[styles.filterChipText, doctorsOnly && styles.filterChipTextActive]}>👩‍⚕️ Médecins</Text>
        </Pressable>
        {COMMUNITY_CATEGORIES.map((c) => {
          const active = activeCat === c;
          return (
            <Pressable key={c} onPress={() => setActiveCat(c)} style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{categoryLabel(c)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isSearching && doctorResults.length > 0 ? (
        <View style={styles.docSection}>
          <Text style={styles.docSectionTitle}>Médecins</Text>
          {doctorResults.map((d) => (
            <DoctorResultRow key={d.id} doctor={d} onPress={onOpenDoctor} />
          ))}
        </View>
      ) : null}

      {posts.length > 0 ? (
        <Text style={styles.count}>{posts.length} publication{posts.length > 1 ? "s" : ""}</Text>
      ) : null}
    </View>
  );

  const listFooter = hasMore ? (
    <View style={styles.footer}>
      {loadingMore ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Pressable onPress={loadMore} style={styles.loadMore}>
          <Text style={styles.loadMoreText}>Charger plus</Text>
        </Pressable>
      )}
    </View>
  ) : null;

  return (
    <Screen>
      <FlatList
        data={posts}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={extra}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={
          isSearching && doctorResults.length === 0 ? (
            <EmptyState
              emoji="🔍"
              title="Aucun résultat"
              message="Aucune publication ni médecin ne correspond à ta recherche."
            />
          ) : isSearching && doctorResults.length > 0 ? (
            <EmptyState
              emoji="💬"
              title="Aucune publication trouvée"
              message="Aucune publication ne correspond, mais des médecins oui — voir ci-dessus."
            />
          ) : (
            <EmptyState
              emoji="💬"
              title={isFiltering ? "Aucune publication trouvée" : "Aucune publication"}
              message={isFiltering ? "Essayez un autre mot-clé ou une autre catégorie." : "Soyez la première à partager quelque chose avec la communauté."}
            />
          )
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={11}
        keyboardShouldPersistTaps="handled"
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

// Carte de post mémoïsée : ne se re-render que si ses props changent (perf liste).
const PostRow = memo(function PostRow({
  post,
  liked,
  saved,
  onToggleSave,
  onMenu,
  onPress,
  onOpenComments,
  onLike,
}: {
  post: CommunityPostWithAuthor;
  liked: boolean;
  saved: boolean;
  onToggleSave: (id: string) => void;
  onMenu: (post: CommunityPostWithAuthor) => void;
  onPress: (id: string) => void;
  onOpenComments: (id: string) => void;
  onLike: (id: string) => void;
}) {
  const name = authorDisplayName(post.is_anonymous, post.author);
  const edited = wasEdited(post.created_at, post.updated_at);

  return (
    <Card onPress={() => onPress(post.id)} accessibilityLabel="Ouvrir la publication" style={styles.post}>
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
              {!post.is_anonymous && post.author?.isVerifiedDoctor ? <VerifiedDoctorBadge specialty={post.author.doctorSpecialty} /> : null}
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
          <Pressable onPress={() => onLike(post.id)} hitSlop={8} style={styles.likeBtn} accessibilityRole="button" accessibilityLabel={liked ? "Je n'aime plus cette publication" : "J'aime cette publication"}>
            <HeartButton active={liked} size={20} />
            <Text style={[styles.likeCount, liked && styles.likeCountActive]}>
              {post.likes_count}
            </Text>
          </Pressable>
          <Pressable onPress={() => onOpenComments(post.id)} hitSlop={8} style={styles.likeBtn} accessibilityRole="button" accessibilityLabel="Voir les commentaires">
            <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
            <Text style={styles.likeCount}>{post.comments_count}</Text>
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

// Ligne « médecin » des résultats de recherche : avatar + nom + spécialité +
// badge vérifié ; appui → fiche du médecin (/(user)/appointments/{id}).
const DoctorResultRow = memo(function DoctorResultRow({
  doctor,
  onPress,
}: {
  doctor: DoctorSearchResult;
  onPress: (id: string) => void;
}) {
  const name = doctor.full_name?.trim() || "Médecin";
  return (
    <Pressable onPress={() => onPress(doctor.id)} style={styles.docRow} accessibilityRole="button" accessibilityLabel={`Voir le médecin ${name}`}>
      <View style={styles.docAvatar}>
        {doctor.avatar_url ? (
          <AppImage source={doctor.avatar_url} style={styles.docAvatarImg} />
        ) : (
          <Ionicons name="medkit" size={18} color={colors.primary} />
        )}
      </View>
      <View style={styles.docInfo}>
        <View style={styles.docNameRow}>
          <Text style={styles.docName} numberOfLines={1}>{name}</Text>
          <VerifiedDoctorBadge />
        </View>
        {doctor.specialty ? <Text style={styles.docSpec} numberOfLines={1}>{doctor.specialty}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
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
  listContent: { paddingBottom: spacing.xxl, gap: spacing.md },
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
  docSection: { marginTop: spacing.sm, gap: spacing.xs },
  docSectionTitle: { ...typography.caption, color: colors.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  docRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  docAvatar: {
    width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  docAvatarImg: { width: 38, height: 38 },
  docInfo: { flex: 1, gap: 2 },
  docNameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  docName: { ...typography.name },
  docSpec: { ...typography.caption, color: colors.primaryDark, fontWeight: "600" },
  body: { ...typography.body, color: colors.text, lineHeight: 21 },
  postImage: { width: "100%", height: 200, borderRadius: radius.md, backgroundColor: colors.surface },
  postFoot: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.xs },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  likeCount: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  likeCountActive: { color: colors.primary },
  commentHint: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  commentHintText: { ...typography.caption, color: colors.textMuted },
});
