import { useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Loading } from "@/components/Loading";
import { ActionSheet, type ActionSheetOption } from "@/components/ActionSheet";
import { useAuth } from "@/providers/AuthProvider";
import {
  communityService,
  authorDisplayName,
  formatRelativeTime,
  wasEdited,
  REPORT_REASONS,
  type CommunityPostWithAuthor,
  type CommunityCommentWithAuthor,
} from "@/lib/community-service";
import { VerifiedDoctorBadge, CategoryTag } from "@/components/CommunityBadges";
import { PostImages } from "@/components/PostImages";
import { HeartButton } from "@/components/HeartButton";
import { BouncyIcon } from "@/components/BouncyIcon";
import { FadeInView } from "@/components/FadeInView";
import { useBookmarks } from "@/hooks/useBookmarks";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { useToast } from "@/providers/ToastProvider";
import { useConfirm } from "@/components/ConfirmDialog";
import { APP_DOWNLOAD_URL } from "@/lib/app-config";
import { colors, fonts, radius, spacing, typography } from "@/theme";

export default function PostDetail() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const router = useRouter();
  const { session, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { savedIds, toggle: toggleSave } = useBookmarks();
  const scrollRef = useRef<ScrollView>(null);
  const didFocusScroll = useRef(false);
  const toast = useToast();
  const confirm = useConfirm();
  const [sheet, setSheet] = useState<{ title?: string; options: ActionSheetOption[] } | null>(null);

  const [post, setPost] = useState<CommunityPostWithAuthor | null>(null);
  const [comments, setComments] = useState<CommunityCommentWithAuthor[]>([]);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);

  const [comment, setComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<CommunityCommentWithAuthor | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  // Fils de réponses repliés (par id du commentaire racine).
  const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(new Set());

  function toggleThread(rootId: string) {
    hapticLight();
    setCollapsedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);
      return next;
    });
  }

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        communityService.getPost(id),
        communityService.getComments(id),
      ]);
      setPost(p);
      setComments(c);
      if (session?.user) {
        const likedIds = await communityService.getLikedPostIds(session.user.id);
        setLiked(likedIds.includes(id));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publication introuvable");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, session?.user]);

  // Recharge à chaque focus (ex. retour depuis l'écran de modification du post).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleLike() {
    if (!session?.user || !post) return;
    hapticLight();
    try {
      const { liked: nowLiked, likesCount } = await communityService.toggleLike(post.id, session.user.id);
      setLiked(nowLiked);
      setPost((prev) => (prev ? { ...prev, likes_count: likesCount } : prev));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible");
    }
  }

  async function handleSend() {
    if (!session?.user || !post) return;
    const text = comment.trim();
    if (!text) return;
    setSending(true);
    try {
      await communityService.addComment({
        postId: post.id,
        userId: session.user.id,
        content: text,
        isAnonymous,
        parentCommentId: replyTo?.id ?? null,
      });
      setComment("");
      setIsAnonymous(false);
      setReplyTo(null);
      const c = await communityService.getComments(post.id);
      setComments(c);
      hapticSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Commentaire échoué");
    } finally {
      setSending(false);
    }
  }

  // Like/unlike d'un commentaire (optimiste + haptique léger).
  async function handleCommentLike(c: CommunityCommentWithAuthor) {
    if (!session?.user) return;
    hapticLight();
    setComments((prev) =>
      prev.map((x) =>
        x.id === c.id ? { ...x, likedByMe: !x.likedByMe, likes_count: x.likes_count + (x.likedByMe ? -1 : 1) } : x
      )
    );
    try {
      await communityService.toggleCommentLike(c.id, c.likedByMe);
    } catch {
      // rollback à l'état initial du commentaire
      setComments((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, likedByMe: c.likedByMe, likes_count: c.likes_count } : x))
      );
    }
  }

  const meId = session?.user?.id;
  // Nom affiché : « Membre Hygiena+ » si anonyme (cohérent avec la carte de post),
  // sinon le nom réel. L'anonymat reste strict (on ne lit pas l'auteur si anonyme).
  const displayName = (c: { is_anonymous: boolean; author: { full_name: string | null } | null }) =>
    c.is_anonymous ? "Membre Hygiena+" : authorDisplayName(false, c.author);
  const myFirstName = profile?.first_name?.trim() || profile?.full_name?.trim().split(" ")[0] || "";

  // Partage natif de la publication + lien de téléchargement de l'app.
  async function sharePost() {
    if (!post) return;
    try {
      await Share.share({ message: `${post.content}\n\nVu sur Hygiena+ 🌸 Télécharge l'app : ${APP_DOWNLOAD_URL}` });
    } catch {
      // partage annulé
    }
  }

  // ---- Menu ⋯ du post (action sheet) ----
  function postMenu() {
    if (!post) return;
    setSheet({
      title: "Ma publication",
      options: [
        { label: "Modifier", icon: "create-outline", onPress: () => router.push({ pathname: "/(user)/community/new", params: { id: post.id } }) },
        { label: "Partager", icon: "share-social-outline", onPress: sharePost },
        { label: "Supprimer", icon: "trash-outline", destructive: true, onPress: deleteMyPost },
      ],
    });
  }

  async function deleteMyPost() {
    if (!post) return;
    if (await confirm({ title: "Supprimer la publication ?", message: "Cette action est définitive.", confirmLabel: "Supprimer", cancelLabel: "Annuler", danger: true })) {
      hapticWarning();
      try {
        await communityService.deletePost(post.id);
        router.back();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Suppression échouée");
      }
    }
  }

  // ---- Mon commentaire : modifier (inline) / supprimer ----
  function startEditComment(c: CommunityCommentWithAuthor) {
    setEditingCommentId(c.id);
    setEditText(c.content);
  }
  function cancelEditComment() {
    setEditingCommentId(null);
    setEditText("");
  }
  async function saveEditComment(c: CommunityCommentWithAuthor) {
    const t = editText.trim();
    if (!t) return;
    setSavingEdit(true);
    try {
      await communityService.updateComment(c.id, t);
      setEditingCommentId(null);
      setEditText("");
      if (post) setComments(await communityService.getComments(post.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Modification échouée");
    } finally {
      setSavingEdit(false);
    }
  }
  function commentMenu(c: CommunityCommentWithAuthor) {
    setSheet({
      title: "Mon commentaire",
      options: [
        { label: "Modifier", icon: "create-outline", onPress: () => startEditComment(c) },
        { label: "Supprimer", icon: "trash-outline", destructive: true, onPress: () => deleteCommentConfirm(c) },
      ],
    });
  }
  async function deleteCommentConfirm(c: CommunityCommentWithAuthor) {
    if (await confirm({ title: "Supprimer le commentaire ?", message: "Cette action est définitive.", confirmLabel: "Supprimer", cancelLabel: "Annuler", danger: true })) {
      hapticWarning();
      try {
        await communityService.deleteComment(c.id);
        if (post) setComments(await communityService.getComments(post.id));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Suppression échouée");
      }
    }
  }

  // Bloque un utilisateur (auteur d'un post ou d'un commentaire).
  async function confirmBlock(userId: string, afterBlock: () => void) {
    if (await confirm({ title: "Bloquer cet utilisateur ?", message: "Tu ne verras plus les publications de cette personne.", confirmLabel: "Bloquer", cancelLabel: "Annuler", danger: true })) {
      try {
        await communityService.blockUser(userId);
        afterBlock();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action impossible");
      }
    }
  }

  // ---- Signalement (contenu des autres) ----
  // Feuille d'actions multiplateforme (web-safe) au lieu d'un Alert à boutons
  // multiples : liste des motifs de signalement.
  function reportReasonAlert(title: string, onPick: (reason: string) => Promise<void>) {
    setSheet({
      title: `${title} — pour quelle raison ?`,
      options: REPORT_REASONS.map((r) => ({
        label: r,
        icon: "flag-outline" as const,
        onPress: async () => {
          try {
            await onPick(r);
            toast.success("Ce contenu a été signalé à la modération.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Signalement impossible");
          }
        },
      })),
    });
  }

  // Menu ⋯ d'un post qui n'est pas le mien : Partager / Signaler (+ Bloquer si non anonyme).
  function postOtherMenu() {
    if (!post) return;
    const canBlock = !post.is_anonymous && !!post.user_id && post.user_id !== meId;
    setSheet({
      title: "Publication",
      options: [
        { label: "Partager", icon: "share-social-outline", onPress: sharePost },
        { label: "Signaler", icon: "flag-outline", onPress: () => reportReasonAlert("Signaler la publication", (r) => communityService.reportPost(post.id, post.user_id ?? null, r)) },
        ...(canBlock ? [{ label: "Bloquer cet utilisateur", icon: "ban-outline" as const, destructive: true, onPress: () => confirmBlock(post.user_id!, () => router.back()) }] : []),
      ],
    });
  }

  // Menu ⋯ d'un commentaire qui n'est pas le mien : Signaler (+ Bloquer si non anonyme).
  function commentOtherMenu(c: CommunityCommentWithAuthor) {
    const canBlock = !c.is_anonymous && c.user_id !== meId;
    setSheet({
      title: "Commentaire",
      options: [
        { label: "Signaler", icon: "flag-outline", onPress: () => reportReasonAlert("Signaler le commentaire", (r) => communityService.reportComment(c, r)) },
        ...(canBlock ? [{ label: "Bloquer cet utilisateur", icon: "ban-outline" as const, destructive: true, onPress: () => confirmBlock(c.user_id, () => load()) }] : []),
      ],
    });
  }

  if (loading) return <Loading />;
  if (!post) return null;

  // Threading : commentaires de premier niveau + réponses regroupées sous leur
  // fil racine (une réponse à une réponse rattache au même fil parent).
  const byId = new Map(comments.map((c) => [c.id, c]));
  const rootId = (c: CommunityCommentWithAuthor): string => {
    let cur = c;
    const seen = new Set<string>();
    while (cur.parent_comment_id && byId.has(cur.parent_comment_id) && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.parent_comment_id)!;
    }
    return cur.id;
  };
  // Épinglage : les commentaires de premier niveau de médecins vérifiés (non
  // anonymes) ressortent en tête, en conservant l'ordre chronologique au sein
  // de chaque groupe (partition stable).
  const isDoctorComment = (c: CommunityCommentWithAuthor) => !c.is_anonymous && c.isVerifiedDoctor;
  const rawTops = comments.filter((c) => !c.parent_comment_id);
  const topComments = [...rawTops.filter(isDoctorComment), ...rawTops.filter((c) => !isDoctorComment(c))];
  const repliesByRoot = new Map<string, CommunityCommentWithAuthor[]>();
  for (const c of comments) {
    if (!c.parent_comment_id) continue;
    const r = rootId(c);
    if (!repliesByRoot.has(r)) repliesByRoot.set(r, []);
    repliesByRoot.get(r)!.push(c);
  }

  function renderComment(c: CommunityCommentWithAuthor, isReply: boolean) {
    // Mise en avant des médecins vérifiés (impossible si l'auteur poste anonymement).
    const highlighted = !c.is_anonymous && c.isVerifiedDoctor;
    const tint = c.is_anonymous ? anonTint(c.id) : { bg: colors.primaryLight, fg: colors.primary };
    const mine = c.user_id === meId;
    const isEditing = editingCommentId === c.id;
    return (
      <View key={c.id} style={[styles.commentRow, isReply && styles.replyRow]}>
        {/* Avatar rond (teinté si anonyme, cohérent avec la carte de post). */}
        <View style={[styles.cAvatar, isReply && styles.cAvatarReply, { backgroundColor: tint.bg }]}>
          <Ionicons name="person" size={isReply ? 13 : 15} color={tint.fg} />
        </View>

        <View style={styles.cMain}>
          {highlighted ? (
            <View style={styles.doctorBanner}>
              <Ionicons name="medkit" size={12} color={colors.primaryDark} />
              <Text style={styles.doctorBannerText}>Réponse de médecin vérifié</Text>
            </View>
          ) : null}

          {isEditing ? (
            <View style={styles.editBox}>
              <Input
                value={editText}
                onChangeText={setEditText}
                placeholder="Modifier le commentaire…"
                multiline
                style={styles.editInput}
              />
              <View style={styles.editActions}>
                <Pressable onPress={cancelEditComment} hitSlop={8} style={styles.editCancel}>
                  <Text style={styles.editCancelText}>Annuler</Text>
                </Pressable>
                <Pressable onPress={() => saveEditComment(c)} disabled={savingEdit} hitSlop={8} style={styles.editSave}>
                  <Text style={styles.editSaveText}>{savingEdit ? "…" : "Enregistrer"}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {/* Bulle (s'ajuste au contenu) + menu ⋯ juste à côté. */}
              <View style={styles.bubbleRow}>
                <View style={[styles.bubble, isReply && styles.bubbleReply, highlighted && styles.bubbleDoctor]}>
                  <View style={styles.bubbleAuthorRow}>
                    <Text style={styles.bubbleAuthor}>{displayName(c)}</Text>
                    {!c.is_anonymous && c.isVerifiedDoctor ? <VerifiedDoctorBadge specialty={c.doctorSpecialty} /> : null}
                  </View>
                  <Text style={styles.bubbleText}>{c.content}</Text>
                </View>
                <Pressable onPress={() => (mine ? commentMenu(c) : commentOtherMenu(c))} hitSlop={8} style={styles.cMenu} accessibilityRole="button" accessibilityLabel={mine ? "Options de mon commentaire" : "Options du commentaire"}>
                  <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
                </Pressable>
              </View>

              {/* Meta sous la bulle : heure · Répondre · J'aime (compteur). */}
              <View style={styles.metaRow}>
                <Text style={styles.metaTime}>{formatRelativeTime(c.created_at)}{wasEdited(c.created_at, c.updated_at) ? " · modifié" : ""}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Pressable onPress={() => { hapticLight(); setReplyTo(c); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Répondre">
                  <Text style={styles.metaAction}>Répondre</Text>
                </Pressable>
                <Text style={styles.metaDot}>·</Text>
                <Pressable onPress={() => handleCommentLike(c)} hitSlop={8} style={styles.metaLike} accessibilityRole="button" accessibilityLabel={c.likedByMe ? "Je n'aime plus" : "J'aime"}>
                  <HeartButton active={c.likedByMe} size={15} />
                  <Text style={[styles.metaAction, c.likedByMe && styles.metaLikeActive]}>{c.likes_count > 0 ? c.likes_count : "J'aime"}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <Screen>
      <FadeInView>
      <ScreenHeader title="Publication" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Card style={styles.post}>
            <View style={styles.postHead}>
              <View style={styles.avatar}>
                <Ionicons
                  name={post.is_anonymous ? "person-outline" : "person"}
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={styles.headInfo}>
                <View style={styles.authorRow}>
                  <Text style={styles.author}>{authorDisplayName(post.is_anonymous, post.author)}</Text>
                  {!post.is_anonymous && post.author?.isVerifiedDoctor ? <VerifiedDoctorBadge specialty={post.author.doctorSpecialty} /> : null}
                </View>
                <Text style={styles.time}>{formatRelativeTime(post.created_at)}{wasEdited(post.created_at, post.updated_at) ? " · modifié" : ""}</Text>
              </View>
              <CategoryTag category={post.category} />
              {post.user_id === meId ? (
                <Pressable onPress={postMenu} hitSlop={10} style={styles.blockBtn} accessibilityRole="button" accessibilityLabel="Options de ma publication">
                  <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
                </Pressable>
              ) : (
                <Pressable onPress={postOtherMenu} hitSlop={10} style={styles.blockBtn} accessibilityRole="button" accessibilityLabel="Options de la publication">
                  <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            <Text style={styles.body}>{post.content}</Text>

            <PostImages imageUrls={post.image_urls} imageUrl={post.image_url} />

            <View style={styles.postFoot}>
              <Pressable onPress={handleLike} hitSlop={8} style={({ pressed }) => [styles.likeBtn, pressed && styles.footPressed]} accessibilityRole="button" accessibilityLabel={liked ? "Je n'aime plus cette publication" : "J'aime cette publication"}>
                <HeartButton active={liked} size={22} />
                <Text style={[styles.likeCount, liked && styles.likeCountActive]}>
                  {post.likes_count}
                </Text>
              </Pressable>
              <Pressable onPress={() => { hapticLight(); toggleSave(post.id); }} hitSlop={8} style={({ pressed }) => [styles.bookmarkBtn, pressed && styles.footPressed]} accessibilityRole="button" accessibilityLabel={savedIds.has(post.id) ? "Retirer des enregistrements" : "Enregistrer la publication"}>
                <BouncyIcon
                  name={savedIds.has(post.id) ? "bookmark" : "bookmark-outline"}
                  size={22}
                  color={savedIds.has(post.id) ? colors.primary : colors.textMuted}
                  popKey={savedIds.has(post.id)}
                />
              </Pressable>
            </View>
          </Card>

          <View
            onLayout={(e) => {
              // Ouverture ciblée « commentaires » (depuis le compteur 💬 du fil).
              if (focus === "comments" && !didFocusScroll.current) {
                didFocusScroll.current = true;
                const y = e.nativeEvent.layout.y;
                requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }));
              }
            }}
          >
            <Text style={[typography.h3, styles.sectionTitle]}>
              Commentaires ({comments.length})
            </Text>
          </View>

          {comments.length === 0 ? (
            <Text style={[typography.body, styles.muted]}>
              Aucun commentaire pour le moment.
            </Text>
          ) : (
            topComments.map((top) => {
              const replies = repliesByRoot.get(top.id) ?? [];
              const isCollapsed = collapsedThreads.has(top.id);
              return (
                <View key={top.id} style={styles.thread}>
                  {renderComment(top, false)}
                  {replies.length > 0 ? (
                    <Pressable onPress={() => toggleThread(top.id)} hitSlop={6} style={styles.threadToggle} accessibilityRole="button" accessibilityLabel={isCollapsed ? "Afficher les réponses" : "Masquer les réponses"}>
                      <Ionicons name={isCollapsed ? "chevron-down" : "chevron-up"} size={14} color={colors.primary} />
                      <Text style={styles.threadToggleText}>
                        {isCollapsed ? `Voir ${replies.length} réponse${replies.length > 1 ? "s" : ""}` : "Masquer les réponses"}
                      </Text>
                    </Pressable>
                  ) : null}
                  {!isCollapsed ? replies.map((r) => renderComment(r, true)) : null}
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          {replyTo ? (
            <View style={styles.replyBanner}>
              <Ionicons name="return-down-forward-outline" size={14} color={colors.primary} />
              <Text style={styles.replyBannerText} numberOfLines={1}>
                Réponse à {displayName(replyTo)}
              </Text>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Annuler la réponse">
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.composerBar}>
            <View style={styles.composerAvatar}>
              <Ionicons name="person" size={16} color={colors.primary} />
            </View>
            <View style={styles.composerPill}>
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder={replyTo ? "Ta réponse…" : myFirstName ? `Commenter en tant que ${myFirstName}…` : "Commenter…"}
                placeholderTextColor={colors.textMuted}
                style={styles.composerInput}
                multiline
              />
              <Pressable
                onPress={() => { hapticLight(); setIsAnonymous((v) => !v); }}
                hitSlop={8}
                style={styles.anonBtn}
                accessibilityRole="switch"
                accessibilityState={{ checked: isAnonymous }}
                accessibilityLabel="Commenter anonymement"
              >
                <Ionicons name={isAnonymous ? "eye-off" : "eye-off-outline"} size={18} color={isAnonymous ? colors.primary : colors.textMuted} />
              </Pressable>
            </View>
            <Pressable
              onPress={handleSend}
              disabled={sending || !comment.trim()}
              style={({ pressed }) => [styles.sendCircle, (sending || !comment.trim()) && styles.sendCircleDisabled, pressed && styles.footPressed]}
              accessibilityRole="button"
              accessibilityLabel="Envoyer"
            >
              {sending ? <ActivityIndicator color={colors.white} size="small" /> : <Ionicons name="send" size={18} color={colors.white} />}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      </FadeInView>

      <ActionSheet
        visible={!!sheet}
        title={sheet?.title}
        options={sheet?.options ?? []}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  post: { gap: spacing.sm },
  postHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: {
    width: 42, height: 42, borderRadius: radius.pill, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  headInfo: { flex: 1 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  blockBtn: { padding: spacing.xs },
  author: { ...typography.name },
  time: { ...typography.caption, color: colors.textMuted },
  body: { ...typography.body, color: colors.text, lineHeight: 22 },
  postFoot: { flexDirection: "row", alignItems: "center", marginTop: spacing.xs },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  footPressed: { opacity: 0.5 },
  bookmarkBtn: { marginLeft: "auto", padding: spacing.xs },
  likeCount: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  likeCountActive: { color: colors.primary },
  sectionTitle: { marginTop: spacing.sm },
  muted: { color: colors.textMuted },
  thread: { gap: spacing.md },
  // Bascule repli/expansion d'un fil, alignée sur l'indentation des réponses.
  threadToggle: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginLeft: spacing.xl },
  threadToggleText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  // ---- Commentaires « bulles » (inspiration Facebook, identité Hygiena+) ----
  commentRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  // Réponse : indentée + ligne de fil discrète à gauche.
  replyRow: { marginLeft: spacing.lg, paddingLeft: spacing.sm, borderLeftWidth: 1.5, borderLeftColor: colors.border },
  cAvatar: { width: 36, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  cAvatarReply: { width: 30, height: 30 },
  cMain: { flex: 1, gap: 2 },
  doctorBanner: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: 2 },
  doctorBannerText: { ...typography.caption, color: colors.primaryDark, fontWeight: "700" },
  bubbleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs },
  // Bulle : fond gris clair tokenisé, coins arrondis, largeur = contenu (pas pleine largeur).
  bubble: { flexShrink: 1, backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleReply: { paddingVertical: spacing.xs },
  bubbleDoctor: { backgroundColor: colors.primaryLight, borderWidth: 1.5, borderColor: colors.primary },
  bubbleAuthorRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap", marginBottom: 1 },
  bubbleAuthor: { ...typography.caption, color: colors.text, fontFamily: fonts.bodyBold, fontWeight: "700" },
  bubbleText: { ...typography.body, color: colors.text, lineHeight: 20 },
  cMenu: { paddingTop: spacing.sm, paddingHorizontal: spacing.xs },
  // Meta sous la bulle : heure · Répondre · J'aime (compteur).
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginLeft: spacing.sm, marginTop: 2 },
  metaTime: { ...typography.caption, color: colors.textMuted },
  metaDot: { ...typography.caption, color: colors.textMuted },
  metaAction: { ...typography.caption, color: colors.textMuted, fontWeight: "700" },
  metaLike: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metaLikeActive: { color: colors.primary },
  editBox: { gap: spacing.xs, marginTop: spacing.xs },
  editInput: { minHeight: 40, height: undefined, textAlignVertical: "top", paddingTop: spacing.sm, marginBottom: 0 },
  editActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.md, alignItems: "center" },
  editCancel: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  editCancelText: { ...typography.caption, color: colors.textMuted, fontWeight: "700" },
  editSave: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primary },
  editSaveText: { ...typography.caption, color: colors.white, fontWeight: "700" },
  replyBanner: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  replyBannerText: { ...typography.caption, color: colors.primaryDark, fontWeight: "600", flex: 1 },
  // ---- Barre de commentaire fixe (sticky, au-dessus du clavier) ----
  composer: {
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.xs,
  },
  composerBar: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  composerAvatar: {
    width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  composerPill: {
    flex: 1, flexDirection: "row", alignItems: "flex-end",
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingLeft: spacing.md, paddingRight: spacing.xs, minHeight: 42,
  },
  composerInput: { flex: 1, ...typography.body, color: colors.text, paddingVertical: spacing.sm, maxHeight: 120 },
  anonBtn: { padding: spacing.xs, alignSelf: "center" },
  sendCircle: {
    width: 42, height: 42, borderRadius: radius.pill, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  sendCircleDisabled: { backgroundColor: colors.border },
});

// Teintes douces (tokens) pour l'avatar des commentaires anonymes — cohérent
// avec la carte de publication. Dérivé de l'id, SANS révéler d'identité.
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
