import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View, type ListRenderItemInfo } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";
import { OfflineBanner } from "@/components/OfflineBanner";
import { AppImage } from "@/components/AppImage";
import { FadeInView } from "@/components/FadeInView";
import { PressableScale } from "@/components/PressableScale";
import { SkeletonList } from "@/components/Skeleton";
import { ActionSheet, type ActionSheetOption } from "@/components/ActionSheet";
import { useCommunity } from "@/hooks/useCommunity";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useAppSettings } from "@/hooks/useAppSettings";
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
import { VerifiedDoctorBadge } from "@/components/CommunityBadges";
import { PostImages } from "@/components/PostImages";
import { HeartButton } from "@/components/HeartButton";
import { BouncyIcon } from "@/components/BouncyIcon";
import { hapticLight, hapticWarning } from "@/lib/haptics";
import { useToast } from "@/providers/ToastProvider";
import { useConfirm } from "@/components/ConfirmDialog";
import { APP_DOWNLOAD_URL } from "@/lib/app-config";
import { colors, radius, shadows, spacing, typography } from "@/theme";

export default function CommunityHome() {
  const [refreshing, setRefreshing] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("all");
  const [doctorsOnly, setDoctorsOnly] = useState(false);
  // Filtre « Suivis » : uniquement les publications des membres que je suis.
  const [followedOnly, setFollowedOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<"recent" | "trending">("recent");
  // Médecins correspondant à la recherche (section en tête du fil).
  const [doctorResults, setDoctorResults] = useState<DoctorSearchResult[]>([]);
  const { community_enabled } = useAppSettings();

  // Filtres appliqués CÔTÉ SERVEUR (recherche + catégorie + tri + filtre médecins).
  const { posts, likedIds, loading, loadingMore, hasMore, error, reload, loadMore, toggleLike, newPostsCount, applyNewPosts } = useCommunity({
    search,
    category: activeCat === "all" ? null : activeCat,
    sort: sortMode === "trending" ? "trending" : "recents",
    doctorsOnly,
    followedOnly,
  });
  const { savedIds, toggle: toggleSave } = useBookmarks();
  const { session, profile } = useAuth();
  const router = useRouter();
  const meId = session?.user?.id;
  const toast = useToast();
  const confirm = useConfirm();
  const isSearching = !!search.trim();
  const isFiltering = isSearching || activeCat !== "all" || doctorsOnly || followedOnly || sortMode === "trending";
  // Prénom pour l'invitation du composeur (« Quoi de neuf, Mariam ? »).
  const firstName = (profile?.first_name || profile?.full_name?.trim().split(/\s+/)[0] || "").trim();

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
  const blockAuthor = useCallback(async (userId: string) => {
    if (await confirm({ title: "Bloquer cet utilisateur ?", message: "Tu ne verras plus les publications de cette personne.", confirmLabel: "Bloquer", cancelLabel: "Annuler", danger: true })) {
      try {
        await communityService.blockUser(userId);
        await reload();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action impossible");
      }
    }
  }, [reload, confirm, toast]);

  // Signale la publication d'un autre : choix de la raison puis insertion.
  const reportPost = useCallback((post: CommunityPostWithAuthor) => {
    // Feuille d'actions multiplateforme (web-safe) : liste des motifs.
    setSheet({
      title: "Signaler la publication — pour quelle raison ?",
      options: REPORT_REASONS.map((r) => ({
        label: r,
        icon: "flag-outline" as const,
        onPress: async () => {
          try {
            await communityService.reportPost(post.id, post.user_id ?? null, r);
            toast.success("Ce contenu a été signalé à la modération.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Signalement impossible");
          }
        },
      })),
    });
  }, [toast]);

  // Supprime MA propre publication (confirmation + haptique).
  const deleteMyPost = useCallback(async (postId: string) => {
    if (await confirm({ title: "Supprimer la publication ?", message: "Cette action est définitive.", confirmLabel: "Supprimer", cancelLabel: "Annuler", danger: true })) {
      hapticWarning();
      try {
        await communityService.deletePost(postId);
        await reload();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Suppression échouée");
      }
    }
  }, [reload, confirm, toast]);

  // Construit le menu ⋯ : MON post → Modifier/Partager/Supprimer ; autre → Partager/Signaler (+ Bloquer).
  const openPostMenu = useCallback((post: CommunityPostWithAuthor) => {
    const isMine = !!post.user_id && post.user_id === meId;
    const canBlock = !post.is_anonymous && !!post.user_id && post.user_id !== meId;
    const options: ActionSheetOption[] = isMine
      ? [
          { label: "Modifier", icon: "create-outline", onPress: () => router.push({ pathname: "/(user)/community/new", params: { id: post.id } }) },
          { label: "Partager", icon: "arrow-redo-outline", onPress: () => sharePost(post) },
          { label: "Supprimer", icon: "trash-outline", destructive: true, onPress: () => deleteMyPost(post.id) },
        ]
      : [
          { label: "Partager", icon: "arrow-redo-outline", onPress: () => sharePost(post) },
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
  // Profil public d'un auteur (jamais appelé pour un post anonyme : user_id null).
  const onOpenProfile = useCallback((userId: string) => router.push(`/(user)/community/profile/${userId}`), [router]);
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
        onShare={sharePost}
        onOpenProfile={onOpenProfile}
      />
    ),
    [likedIds, savedIds, onSavePost, openPostMenu, onPressPost, onOpenCommentsPost, onLikePost, sharePost, onOpenProfile]
  );

  // Service désactivé par l'admin : état neutre (n'empêche pas les autres onglets).
  if (!community_enabled) {
    return (
      <Screen>
        <View style={styles.topBar}>
          <Text style={typography.h2}>Communauté</Text>
        </View>
        <EmptyState
          icon="people-outline"
          title="Service non disponible pour le moment"
          message="La communauté est temporairement désactivée."
        />
      </Screen>
    );
  }

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
        <View>
          <Text style={typography.h2}>Entre nous 🤍</Text>
          <Text style={styles.tagline}>Un espace sûr, avec de vraies médecins</Text>
        </View>
        <View style={styles.topActions}>
          <PressableScale onPress={() => router.push("/(user)/community/rules")} haptic hitSlop={10} scaleTo={0.86} style={styles.iconBtn} accessibilityLabel="Règles de la communauté">
            <Ionicons name="information-circle-outline" size={23} color={colors.text} />
          </PressableScale>
          <PressableScale onPress={() => router.push("/(user)/community/saved")} haptic hitSlop={10} scaleTo={0.86} style={styles.iconBtn} accessibilityLabel="Publications enregistrées">
            <Ionicons name="bookmark-outline" size={22} color={colors.text} />
          </PressableScale>
        </View>
      </View>

      {/* Composeur « Salon » (façon Facebook) : avatar + invitation à publier,
          puis raccourcis Photo / Anonyme / Catégorie. Chaque zone ouvre l'écran
          de création, pré-configuré pour les raccourcis. */}
      <View style={styles.composer}>
        <View style={styles.composerRow}>
          <Avatar uri={profile?.avatar_url} name={profile?.full_name || profile?.email || "?"} size={38} />
          <Pressable
            onPress={() => { hapticLight(); router.push("/(user)/community/new"); }}
            style={({ pressed }) => [styles.composerPrompt, pressed && styles.chipPressed]}
            accessibilityRole="button"
            accessibilityLabel="Écrire une publication"
          >
            <Text style={styles.composerPromptText} numberOfLines={1}>
              {firstName ? `Quoi de neuf, ${firstName} ?` : "Quoi de neuf ?"}
            </Text>
          </Pressable>
        </View>
        <View style={styles.composerActions}>
          <Pressable
            onPress={() => { hapticLight(); router.push({ pathname: "/(user)/community/new", params: { photo: "1" } }); }}
            style={({ pressed }) => [styles.composerQuick, pressed && styles.chipPressed]}
            accessibilityRole="button"
            accessibilityLabel="Publier une photo"
          >
            <Ionicons name="image" size={16} color={colors.secondary} />
            <Text style={styles.composerQuickText}>Photo</Text>
          </Pressable>
          <View style={styles.composerDivider} />
          <Pressable
            onPress={() => { hapticLight(); router.push({ pathname: "/(user)/community/new", params: { anonymous: "1" } }); }}
            style={({ pressed }) => [styles.composerQuick, pressed && styles.chipPressed]}
            accessibilityRole="button"
            accessibilityLabel="Publier anonymement"
          >
            <Ionicons name="flower" size={16} color={colors.danger} />
            <Text style={styles.composerQuickText}>Anonyme</Text>
          </Pressable>
          <View style={styles.composerDivider} />
          <Pressable
            onPress={() => { hapticLight(); router.push({ pathname: "/(user)/community/new", params: { category: "1" } }); }}
            style={({ pressed }) => [styles.composerQuick, pressed && styles.chipPressed]}
            accessibilityRole="button"
            accessibilityLabel="Publier dans une catégorie"
          >
            <Ionicons name="pricetag" size={15} color={colors.accent} />
            <Text style={styles.composerQuickText}>Catégorie</Text>
          </Pressable>
        </View>
      </View>

      {/* Recherche slim + tri compact (bascule Récents ↔ Tendances) sur une ligne. */}
      <View style={styles.searchRow}>
        <View style={styles.searchFieldWrap}>
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher…"
            autoCapitalize="none"
            style={styles.searchInput}
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterChips}>
        <Pressable onPress={() => { hapticLight(); setActiveCat("all"); setSortMode("recent"); }} style={({ pressed }) => [styles.filterChip, activeCat === "all" && sortMode === "recent" && styles.filterChipActive, pressed && styles.chipPressed]}>
          <Text style={[styles.filterChipText, activeCat === "all" && sortMode === "recent" && styles.filterChipTextActive]}>✨ Pour toi</Text>
        </Pressable>
        <Pressable onPress={() => { hapticLight(); setSortMode((m) => (m === "trending" ? "recent" : "trending")); }} style={({ pressed }) => [styles.filterChip, sortMode === "trending" && styles.filterChipActive, pressed && styles.chipPressed]}>
          <Text style={[styles.filterChipText, sortMode === "trending" && styles.filterChipTextActive]}>🔥 Tendances</Text>
        </Pressable>
        <Pressable onPress={() => { hapticLight(); setFollowedOnly((v) => !v); }} style={({ pressed }) => [styles.filterChip, followedOnly && styles.filterChipActive, pressed && styles.chipPressed]}>
          <Text style={[styles.filterChipText, followedOnly && styles.filterChipTextActive]}>⭐ Suivis</Text>
        </Pressable>
        <Pressable onPress={() => { hapticLight(); setDoctorsOnly((v) => !v); }} style={({ pressed }) => [styles.filterChip, doctorsOnly && styles.filterChipActive, pressed && styles.chipPressed]}>
          <Text style={[styles.filterChipText, doctorsOnly && styles.filterChipTextActive]}>👩‍⚕️ Médecins</Text>
        </Pressable>
        {COMMUNITY_CATEGORIES.map((c) => {
          const active = activeCat === c;
          return (
            <Pressable key={c} onPress={() => { hapticLight(); setActiveCat(c); }} style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && styles.chipPressed]}>
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

      {/* Pastille TEMPS RÉEL : des publications sont arrivées pendant la lecture.
          Un tap → rechargement de la page 0 (le compteur repart à zéro). */}
      {newPostsCount > 0 ? (
        <Pressable onPress={applyNewPosts} style={({ pressed }) => [styles.livePill, pressed && styles.chipPressed]} accessibilityRole="button" accessibilityLabel={`${newPostsCount} nouvelles publications, toucher pour actualiser`}>
          <View style={styles.liveDot} />
          <Text style={styles.livePillText}>
            {newPostsCount} nouvelle{newPostsCount > 1 ? "s" : ""} publication{newPostsCount > 1 ? "s" : ""} ↑
          </Text>
        </Pressable>
      ) : null}

    </View>
  );

  // Scroll infini pur : onEndReached charge la suite, seul un spinner s'affiche
  // (le bouton « Charger plus » est supprimé — plus personne ne fait ça).
  const listFooter = hasMore && loadingMore ? (
    <View style={styles.footer}>
      <ActivityIndicator color={colors.primary} />
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
              message={isFiltering ? "Essaie un autre mot-clé ou une autre catégorie." : "Sois la première à partager quelque chose avec la communauté."}
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

// Teintes douces (tokens) pour l'avatar des publications anonymes : un peu de
// variété visuelle « façon Reddit », dérivée de l'id du post — SANS jamais
// révéler d'identité (l'anonymat reste strict, on ne lit pas l'auteur).
const ANON_TINTS: { bg: string; fg: string }[] = [
  { bg: colors.primaryLight, fg: colors.primaryDark },
  { bg: colors.infoSoft, fg: colors.secondary },
  { bg: colors.warningSoft, fg: colors.warning },
  { bg: colors.successSoft, fg: colors.success },
  { bg: colors.dangerSoft, fg: colors.danger },
  { bg: colors.neutralSoft, fg: colors.textMuted },
];
function anonTint(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ANON_TINTS[h % ANON_TINTS.length];
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
  onShare,
  onOpenProfile,
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
  onOpenProfile: (userId: string) => void;
}) {
  const isAnon = post.is_anonymous;
  // Anonyme : libellé intentionnel + avatar teinté. Sinon : nom réel (logique inchangée).
  const name = isAnon ? "Membre Hygiena+" : authorDisplayName(false, post.author);
  const tint = isAnon ? anonTint(post.id) : null;
  const edited = wasEdited(post.created_at, post.updated_at);
  // L'auteur a un profil consultable seulement si le post n'est PAS anonyme.
  const canOpenProfile = !isAnon && !!post.user_id;
  // Contenu long : aperçu tronqué + « Voir plus / Voir moins » (inline, sans ouvrir le post).
  const [expanded, setExpanded] = useState(false);
  const isLong = post.content.length > 220 || (post.content.match(/\n/g)?.length ?? 0) >= 4;

  return (
    <FadeInView fill={false}>
    <Card onPress={() => onPress(post.id)} accessibilityLabel="Ouvrir la publication" style={styles.post}>
        {/* En-tête : avatar photo (ou initiale) + (nom gras / temps · chip catégorie) + menu ⋯
            Avatar et nom sont TOUCHABLES → page profil (posts non anonymes uniquement). */}
        <View style={styles.postHead}>
          <Pressable
            onPress={canOpenProfile ? () => { hapticLight(); onOpenProfile(post.user_id!); } : undefined}
            disabled={!canOpenProfile}
            hitSlop={4}
            accessibilityRole={canOpenProfile ? "button" : undefined}
            accessibilityLabel={canOpenProfile ? `Voir le profil de ${name}` : undefined}
          >
            {isAnon ? (
              <View style={[styles.avatar, { backgroundColor: tint!.bg }]}>
                <Ionicons name="person" size={18} color={tint!.fg} />
              </View>
            ) : (
              <Avatar uri={post.author?.avatar_url} name={name} size={40} />
            )}
          </Pressable>
          <View style={styles.headInfo}>
            <View style={styles.authorRow}>
              <Pressable
                onPress={canOpenProfile ? () => { hapticLight(); onOpenProfile(post.user_id!); } : undefined}
                disabled={!canOpenProfile}
                hitSlop={4}
              >
                <Text style={styles.author} numberOfLines={1}>{name}</Text>
              </Pressable>
              {!isAnon && post.author?.isVerifiedDoctor ? <VerifiedDoctorBadge specialty={post.author.doctorSpecialty} /> : null}
              {isAnon ? (
                <View style={styles.anonBadge}>
                  <Ionicons name="lock-closed" size={9} color={colors.textMuted} />
                  <Text style={styles.anonBadgeText}>Anonyme</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.time}>{formatRelativeTime(post.created_at)}{edited ? " · modifié" : ""}</Text>
              {post.category ? (
                <View style={styles.catChip}>
                  <Text style={styles.catChipText}>{categoryLabel(post.category)}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <Pressable onPress={() => onMenu(post)} hitSlop={10} style={styles.menuBtn} accessibilityRole="button" accessibilityLabel="Options de la publication">
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Contenu */}
        <Text style={styles.body} numberOfLines={expanded ? undefined : 5}>{post.content}</Text>
        {isLong ? (
          <Pressable onPress={() => { hapticLight(); setExpanded((v) => !v); }} hitSlop={6} accessibilityRole="button" accessibilityLabel={expanded ? "Voir moins" : "Voir plus"}>
            <Text style={styles.seeMore}>{expanded ? "Voir moins" : "Voir plus"}</Text>
          </Pressable>
        ) : null}

        <PostImages imageUrls={post.image_urls} imageUrl={post.image_url} />

        {/* Ligne des compteurs (façon Facebook) : cœurs à gauche, commentaires à
            droite. Masquée quand la publication n'a encore aucune réaction. */}
        {post.likes_count > 0 || post.comments_count > 0 ? (
          <View style={styles.countsRow}>
            {post.likes_count > 0 ? (
              <View style={styles.countsLeft}>
                <View style={styles.likeBadge}>
                  <Ionicons name="heart" size={10} color={colors.white} />
                </View>
                <Text style={styles.countsText}>{post.likes_count}</Text>
              </View>
            ) : <View />}
            {post.comments_count > 0 ? (
              <Pressable onPress={() => onOpenComments(post.id)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Voir les commentaires">
                <Text style={styles.countsText}>
                  {post.comments_count} commentaire{post.comments_count > 1 ? "s" : ""}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Barre d'actions « Salon » : 4 boutons égaux (J'aime / Commenter /
            Partager / Garder). Le partage reprend la flèche courbe de Facebook. */}
        <View style={styles.actionBar}>
          <Pressable onPress={() => { hapticLight(); onLike(post.id); }} hitSlop={6} style={({ pressed }) => [styles.actionBtn, pressed && styles.footPressed]} accessibilityRole="button" accessibilityLabel={liked ? "Je n'aime plus cette publication" : "J'aime cette publication"}>
            <HeartButton active={liked} size={17} />
            <Text style={[styles.actionLabel, liked && styles.actionLabelLiked]}>J'aime</Text>
          </Pressable>
          <Pressable onPress={() => onOpenComments(post.id)} hitSlop={6} style={({ pressed }) => [styles.actionBtn, pressed && styles.footPressed]} accessibilityRole="button" accessibilityLabel="Commenter la publication">
            <Ionicons name="chatbubble-outline" size={16} color={colors.textMuted} />
            <Text style={styles.actionLabel}>Commenter</Text>
          </Pressable>
          <Pressable onPress={() => { hapticLight(); onShare(post); }} hitSlop={6} style={({ pressed }) => [styles.actionBtn, pressed && styles.footPressed]} accessibilityRole="button" accessibilityLabel="Partager la publication">
            <Ionicons name="arrow-redo-outline" size={17} color={colors.textMuted} />
            <Text style={styles.actionLabel}>Partager</Text>
          </Pressable>
          <Pressable onPress={() => { hapticLight(); onToggleSave(post.id); }} hitSlop={6} style={({ pressed }) => [styles.actionBtn, pressed && styles.footPressed]} accessibilityRole="button" accessibilityLabel={saved ? "Retirer des enregistrements" : "Enregistrer la publication"}>
            <BouncyIcon name={saved ? "bookmark" : "bookmark-outline"} size={16} color={saved ? colors.primary : colors.textMuted} popKey={saved} />
            <Text style={[styles.actionLabel, saved && styles.actionLabelSaved]}>Garder</Text>
          </Pressable>
        </View>

        {/* Aperçu du 1ᵉʳ commentaire (le plus aimé), sous la barre d'actions
            comme sur Facebook. Un tap → commentaires du post. */}
        {post.firstComment ? (
          <Pressable onPress={() => onOpenComments(post.id)} style={({ pressed }) => [styles.cPreview, pressed && styles.footPressed]} accessibilityRole="button" accessibilityLabel="Voir les commentaires">
            <View style={styles.cPreviewAvatar}>
              <Text style={styles.cPreviewAvatarText}>{(post.firstComment.name || "?").trim().charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.cPreviewBody}>
              <Text style={styles.cPreviewText} numberOfLines={2}>
                <Text style={styles.cPreviewName}>{post.firstComment.name}{post.firstComment.isVerifiedDoctor ? " ✔" : ""}</Text>
                {"  "}{post.firstComment.content}
              </Text>
              {post.comments_count > 1 ? (
                <Text style={styles.cPreviewMore}>Voir les {post.comments_count} commentaires</Text>
              ) : null}
            </View>
          </Pressable>
        ) : null}
    </Card>
    </FadeInView>
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
  topBar: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingTop: spacing.lg },
  tagline: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  anonBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  anonBadgeText: { fontSize: 9.5, fontWeight: "800", color: colors.textMuted, fontFamily: typography.caption.fontFamily },
  cPreviewAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  cPreviewAvatarText: { fontSize: 10, fontWeight: "900", color: colors.primaryDark, fontFamily: typography.caption.fontFamily },
  cPreviewBody: { flex: 1 },
  // Composeur « Salon » (façon Facebook) en tête du fil.
  composer: {
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, marginTop: spacing.md,
    gap: spacing.sm, ...shadows.sm,
  },
  composerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  composerPrompt: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 1,
  },
  composerPromptText: { ...typography.body, fontSize: 13.5, color: colors.textMuted, fontWeight: "600" },
  composerActions: {
    flexDirection: "row", alignItems: "center",
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm,
  },
  composerQuick: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 2 },
  composerQuickText: { fontSize: 12, fontWeight: "800", color: colors.textMuted, fontFamily: typography.caption.fontFamily },
  composerDivider: { width: 1, height: 16, backgroundColor: colors.border },
  topActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconBtn: { padding: spacing.xs },
  chipPressed: { opacity: 0.7 },
  footPressed: { opacity: 0.5 },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  listContent: { paddingBottom: spacing.xxl, gap: spacing.md },
  empty: { gap: spacing.sm, alignItems: "center" },
  emptyEmoji: { fontSize: 34 },
  muted: { color: colors.textMuted },
  seeMore: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  post: { gap: spacing.sm },
  postHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: {
    width: 40, height: 40, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  headInfo: { flex: 1, gap: 2 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  menuBtn: { padding: spacing.xs, alignSelf: "flex-start" },
  author: { ...typography.name },
  time: { ...typography.caption, color: colors.textMuted },
  catChip: { backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.pill },
  catChipText: { ...typography.caption, fontSize: 11, color: colors.primaryDark, fontWeight: "700" },
  // Ligne recherche slim + tri compact.
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: spacing.sm },
  searchFieldWrap: { flex: 1 },
  searchInput: { marginBottom: 0 },
  // Tri compact (chip discret), bascule Récents ↔ Tendances.
  footer: { alignItems: "center", paddingVertical: spacing.md },
  // Pastille « N nouvelles publications ↑ » (temps réel), centrée au-dessus du fil.
  livePill: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "center",
    backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, marginTop: spacing.sm, ...shadows.md,
  },
  livePillText: { color: colors.white, fontSize: 12.5, fontWeight: "800" },
  liveDot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.white },
  // Aperçu du 1ᵉʳ commentaire sous le contenu du post.
  cPreview: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  cPreviewText: { ...typography.caption, fontSize: 12.5, lineHeight: 17, color: colors.text },
  cPreviewName: { fontWeight: "800" },
  cPreviewMore: { ...typography.caption, fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  // Rangée de catégories : chips fines (déclutter).
  filterBar: { flexGrow: 0, flexShrink: 0 },
  filterChips: { gap: spacing.xs, alignItems: "center", paddingVertical: spacing.sm },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 13, fontWeight: "600", color: colors.text },
  filterChipTextActive: { color: colors.white, fontWeight: "700" },
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
  body: { ...typography.body, color: colors.text, lineHeight: 22 },
  // Ligne des compteurs (cœurs / commentaires), au-dessus de la barre d'actions.
  countsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  countsLeft: { flexDirection: "row", alignItems: "center", gap: 5 },
  likeBadge: {
    width: 17, height: 17, borderRadius: radius.pill, backgroundColor: colors.danger,
    alignItems: "center", justifyContent: "center",
  },
  countsText: { ...typography.caption, fontSize: 12.5, color: colors.textMuted, fontWeight: "600" },
  // Barre d'actions « Salon » : 4 boutons égaux séparés du contenu par un filet.
  actionBar: {
    flexDirection: "row", alignItems: "center",
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
  },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 4, borderRadius: radius.sm,
  },
  actionLabel: { fontSize: 12, fontWeight: "800", color: colors.textMuted, fontFamily: typography.caption.fontFamily },
  actionLabelLiked: { color: colors.danger },
  actionLabelSaved: { color: colors.primary },
});
