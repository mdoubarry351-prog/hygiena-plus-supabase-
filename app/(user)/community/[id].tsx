import { useEffect, useState, useCallback } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";
import { useAuth } from "@/providers/AuthProvider";
import {
  communityService,
  authorDisplayName,
  formatRelativeTime,
  type CommunityPostWithAuthor,
  type CommunityCommentWithAuthor,
} from "@/lib/community-service";
import { VerifiedDoctorBadge, CategoryTag } from "@/components/CommunityBadges";
import { colors, fonts, radius, spacing, typography } from "@/theme";

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [post, setPost] = useState<CommunityPostWithAuthor | null>(null);
  const [comments, setComments] = useState<CommunityCommentWithAuthor[]>([]);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);

  const [comment, setComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [sending, setSending] = useState(false);

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

  useEffect(() => { load(); }, [load]);

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
      });
      setComment("");
      setIsAnonymous(false);
      const c = await communityService.getComments(post.id);
      setComments(c);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Commentaire échoué");
    } finally {
      setSending(false);
    }
  }

  const meId = session?.user?.id;

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

  if (loading) return <Loading />;
  if (!post) return null;

  return (
    <Screen>
      <ScreenHeader title="Publication" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
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
                  {!post.is_anonymous && post.author?.isVerifiedDoctor ? <VerifiedDoctorBadge /> : null}
                </View>
                <Text style={styles.time}>{formatRelativeTime(post.created_at)}</Text>
              </View>
              <CategoryTag category={post.category} />
              {!post.is_anonymous && post.user_id && post.user_id !== meId ? (
                <Pressable onPress={() => confirmBlock(post.user_id!, () => router.back())} hitSlop={10} style={styles.blockBtn}>
                  <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.body}>{post.content}</Text>

            <View style={styles.postFoot}>
              <Pressable onPress={handleLike} hitSlop={8} style={styles.likeBtn}>
                <Ionicons
                  name={liked ? "heart" : "heart-outline"}
                  size={22}
                  color={liked ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.likeCount, liked && styles.likeCountActive]}>
                  {post.likes_count}
                </Text>
              </Pressable>
            </View>
          </Card>

          <Text style={[typography.h3, styles.sectionTitle]}>
            Commentaires ({comments.length})
          </Text>

          {comments.length === 0 ? (
            <Text style={[typography.body, styles.muted]}>
              Aucun commentaire pour le moment.
            </Text>
          ) : (
            comments.map((c) => (
              <View key={c.id} style={styles.comment}>
                <View style={styles.commentAvatar}>
                  <Ionicons
                    name={c.is_anonymous ? "person-outline" : "person"}
                    size={15}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.commentBody}>
                  <View style={styles.commentHead}>
                    <View style={styles.authorRow}>
                      <Text style={styles.commentAuthor}>
                        {authorDisplayName(c.is_anonymous, c.author)}
                      </Text>
                      {!c.is_anonymous && c.isVerifiedDoctor ? <VerifiedDoctorBadge /> : null}
                    </View>
                    <View style={styles.commentRight}>
                      <Text style={styles.commentTime}>{formatRelativeTime(c.created_at)}</Text>
                      {!c.is_anonymous && c.user_id !== meId ? (
                        <Pressable onPress={() => confirmBlock(c.user_id, () => load())} hitSlop={8} style={styles.blockBtn}>
                          <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  <Text style={styles.commentText}>{c.content}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.composer}>
          <Input
            value={comment}
            onChangeText={setComment}
            placeholder="Écrire un commentaire…"
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
  postFoot: { flexDirection: "row", alignItems: "center", marginTop: spacing.xs },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  likeCount: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  likeCountActive: { color: colors.primary },
  sectionTitle: { marginTop: spacing.sm },
  muted: { color: colors.textMuted },
  comment: { flexDirection: "row", gap: spacing.sm },
  commentAvatar: {
    width: 30, height: 30, borderRadius: radius.pill, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  commentBody: { flex: 1, gap: 2 },
  commentHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  commentAuthor: { ...typography.caption, color: colors.text, fontFamily: fonts.bodyBold, fontWeight: "700" },
  commentTime: { ...typography.caption, color: colors.textMuted },
  commentText: { ...typography.body, color: colors.text, lineHeight: 20 },
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
