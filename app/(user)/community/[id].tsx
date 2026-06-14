import { useRef, useState, useCallback } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
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
import { FadeInView } from "@/components/FadeInView";
import { useBookmarks } from "@/hooks/useBookmarks";
import { hapticLight, hapticWarning } from "@/lib/haptics";
import { useToast } from "@/providers/ToastProvider";
import { APP_DOWNLOAD_URL } from "@/lib/app-config";
import { colors, fonts, radius, spacing, typography } from "@/theme";

export default function PostDetail() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { savedIds, toggle: toggleSave } = useBookmarks();
  const scrollRef = useRef<ScrollView>(null);
  const didFocusScroll = useRef(false);
  const toast = useToast();
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
      Alert.alert("Erreur", e instanceof Error ? e.message : "Publication introuvable", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [id, session?.user]);

  // Recharge à chaque focus (ex. retour depuis l'écran de modification du post).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleLike() {
    if (!session?.user || !post) return;
    try {
      const { liked: nowLiked, likesCount } = await communityService.toggleLike(post.id, session.user.id);
      setLiked(nowLiked);
      setPost((prev) => (prev ? { ...prev, likes_count: likesCount } : prev));
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Action impossible");
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
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Commentaire échoué");
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

  function deleteMyPost() {
    if (!post) return;
    Alert.alert("Supprimer la publication ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          hapticWarning();
          try {
            await communityService.deletePost(post.id);
            router.back();
          } catch (e) {
            Alert.alert("Erreur", e instanceof Error ? e.message : "Suppression échouée");
          }
        },
      },
    ]);
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
      Alert.alert("Erreur", e instanceof Error ? e.message : "Modification échouée");
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
  function deleteCommentConfirm(c: CommunityCommentWithAuthor) {
    Alert.alert("Supprimer le commentaire ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          hapticWarning();
          try {
            await communityService.deleteComment(c.id);
            if (post) setComments(await communityService.getComments(post.id));
          } catch (e) {
            Alert.alert("Erreur", e instanceof Error ? e.message : "Suppression échouée");
          }
        },
      },
    ]);
  }

  // Bloque un utilisateur (auteur d'un post ou d'un commentaire).
  function confirmBlock(userId: string, afterBlock: () => void) {
    Alert.alert("Bloquer cet utilisateur ?", "Vous ne verrez plus les publications de cette personne.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Bloquer",
        style: "destructive",
        onPress: async () => {
          try {
            await communityService.blockUser(userId);
            afterBlock();
          } catch (e) {
            Alert.alert("Erreur", e instanceof Error ? e.message : "Action impossible");
          }
        },
      },
    ]);
  }

  // ---- Signalement (contenu des autres) ----
  function reportReasonAlert(title: string, onPick: (reason: string) => Promise<void>) {
    const buttons = REPORT_REASONS.map((r) => ({
      text: r,
      onPress: async () => {
        try {
          await onPick(r);
          toast.success("Ce contenu a été signalé à la modération.");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Signalement impossible");
        }
      },
    }));
    Alert.alert(title, "Pour quelle raison ?", [...buttons, { text: "Annuler", style: "cancel" }]);
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
    return (
      <View
        key={c.id}
        style={[
          styles.comment,
          isReply && (highlighted ? styles.replyIndent : styles.replyComment),
          highlighted && styles.doctorComment,
        ]}
      >
        <View style={[styles.commentAvatar, isReply && styles.replyAvatar, highlighted && styles.doctorAvatar]}>
          <Ionicons name={c.is_anonymous ? "person-outline" : "person"} size={isReply ? 13 : 15} color={colors.primary} />
        </View>
        <View style={styles.commentBody}>
          {highlighted ? (
            <View style={styles.doctorBanner}>
              <Ionicons name="medkit" size={13} color={colors.primaryDark} />
              <Text style={styles.doctorBannerText}>Réponse de médecin vérifié</Text>
            </View>
          ) : null}
          <View style={styles.commentHead}>
            <View style={styles.authorRow}>
              <Text style={styles.commentAuthor}>{authorDisplayName(c.is_anonymous, c.author)}</Text>
              {!c.is_anonymous && c.isVerifiedDoctor ? <VerifiedDoctorBadge specialty={c.doctorSpecialty} /> : null}
            </View>
            <View style={styles.commentRight}>
              <Text style={styles.commentTime}>{formatRelativeTime(c.created_at)}{wasEdited(c.created_at, c.updated_at) ? " · modifié" : ""}</Text>
              {c.user_id === meId ? (
                <Pressable onPress={() => commentMenu(c)} hitSlop={8} style={styles.blockBtn} accessibilityRole="button" accessibilityLabel="Options de mon commentaire">
                  <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
                </Pressable>
              ) : (
                <Pressable onPress={() => commentOtherMenu(c)} hitSlop={8} style={styles.blockBtn} accessibilityRole="button" accessibilityLabel="Options du commentaire">
                  <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
          </View>
          {editingCommentId === c.id ? (
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
              <Text style={styles.commentText}>{c.content}</Text>
              <View style={styles.commentActions}>
                <Pressable onPress={() => handleCommentLike(c)} hitSlop={8} style={styles.commentAction} accessibilityRole="button" accessibilityLabel={c.likedByMe ? "Je n'aime plus" : "J'aime"}>
                  <HeartButton active={c.likedByMe} size={16} />
                  <Text style={[styles.commentActionText, c.likedByMe && styles.likeCountActive]}>{c.likes_count}</Text>
                </Pressable>
                <Pressable onPress={() => setReplyTo(c)} hitSlop={8} style={styles.commentAction} accessibilityRole="button" accessibilityLabel="Répondre">
                  <Ionicons name="return-down-forward-outline" size={15} color={colors.textMuted} />
                  <Text style={styles.commentActionText}>Répondre</Text>
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
              <Pressable onPress={handleLike} hitSlop={8} style={styles.likeBtn}>
                <HeartButton active={liked} size={22} />
                <Text style={[styles.likeCount, liked && styles.likeCountActive]}>
                  {post.likes_count}
                </Text>
              </Pressable>
              <Pressable onPress={() => toggleSave(post.id)} hitSlop={8} style={styles.bookmarkBtn} accessibilityRole="button" accessibilityLabel={savedIds.has(post.id) ? "Retirer des enregistrements" : "Enregistrer la publication"}>
                <Ionicons
                  name={savedIds.has(post.id) ? "bookmark" : "bookmark-outline"}
                  size={22}
                  color={savedIds.has(post.id) ? colors.primary : colors.textMuted}
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
            topComments.map((top) => (
              <View key={top.id} style={styles.thread}>
                {renderComment(top, false)}
                {(repliesByRoot.get(top.id) ?? []).map((r) => renderComment(r, true))}
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.composer}>
          {replyTo ? (
            <View style={styles.replyBanner}>
              <Ionicons name="return-down-forward-outline" size={14} color={colors.primary} />
              <Text style={styles.replyBannerText} numberOfLines={1}>
                En réponse à {authorDisplayName(replyTo.is_anonymous, replyTo.author)}
              </Text>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Annuler la réponse">
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : null}
          <Input
            value={comment}
            onChangeText={setComment}
            placeholder={replyTo ? "Votre réponse…" : "Écrire un commentaire…"}
            multiline
            style={styles.composerInput}
          />
          <View style={styles.composerRow}>
            <View style={styles.anonToggle}>
              <Switch
                value={isAnonymous}
                onValueChange={setIsAnonymous}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.white}
              />
              <Text style={styles.anonLabel}>Anonyme</Text>
            </View>
            <View style={styles.sendBtn}>
              <Button title="Envoyer" onPress={handleSend} loading={sending} />
            </View>
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
  commentRight: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  author: { ...typography.name },
  time: { ...typography.caption, color: colors.textMuted },
  body: { ...typography.body, color: colors.text, lineHeight: 22 },
  postImage: { width: "100%", height: 200, borderRadius: radius.md, backgroundColor: colors.surface, marginTop: spacing.sm },
  postFoot: { flexDirection: "row", alignItems: "center", marginTop: spacing.xs },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  bookmarkBtn: { marginLeft: "auto", padding: spacing.xs },
  likeCount: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  likeCountActive: { color: colors.primary },
  sectionTitle: { marginTop: spacing.sm },
  muted: { color: colors.textMuted },
  thread: { gap: spacing.md },
  comment: { flexDirection: "row", gap: spacing.sm },
  replyComment: { marginLeft: spacing.xl, paddingLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.border },
  replyIndent: { marginLeft: spacing.xl },
  // Mise en avant médecin vérifié : encart vert clair sobre + bordure verte.
  doctorComment: { backgroundColor: colors.primaryLight, borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md, padding: spacing.sm },
  doctorAvatar: { backgroundColor: colors.white },
  doctorBanner: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: 2 },
  doctorBannerText: { ...typography.caption, color: colors.primaryDark, fontWeight: "700" },
  commentAvatar: {
    width: 30, height: 30, borderRadius: radius.pill, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  replyAvatar: { width: 26, height: 26 },
  commentBody: { flex: 1, gap: 2 },
  commentHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  commentAuthor: { ...typography.caption, color: colors.text, fontFamily: fonts.bodyBold, fontWeight: "700" },
  commentTime: { ...typography.caption, color: colors.textMuted },
  commentText: { ...typography.body, color: colors.text, lineHeight: 20 },
  commentActions: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.xs },
  commentAction: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  commentActionText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  editBox: { gap: spacing.xs, marginTop: spacing.xs },
  editInput: { minHeight: 40, height: undefined, textAlignVertical: "top", paddingTop: spacing.sm, marginBottom: 0 },
  editActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.md, alignItems: "center" },
  editCancel: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  editCancelText: { ...typography.caption, color: colors.textMuted, fontWeight: "700" },
  editSave: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primary },
  editSaveText: { ...typography.caption, color: colors.white, fontWeight: "700" },
  replyBanner: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  replyBannerText: { ...typography.caption, color: colors.primaryDark, fontWeight: "600", flex: 1 },
  composer: {
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.sm,
  },
  composerInput: { minHeight: 44, height: undefined, textAlignVertical: "top", paddingTop: spacing.sm, marginBottom: 0 },
  composerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  anonToggle: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  anonLabel: { ...typography.caption, color: colors.text },
  sendBtn: { flex: 1, maxWidth: 160 },
});
