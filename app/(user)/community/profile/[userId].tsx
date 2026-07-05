import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { Loading } from "@/components/Loading";
import { FadeInView } from "@/components/FadeInView";
import { VerifiedDoctorBadge } from "@/components/CommunityBadges";
import { hapticLight } from "@/lib/haptics";
import { useToast } from "@/providers/ToastProvider";
import {
  communityService,
  formatRelativeTime,
  categoryLabel,
  type PublicProfile,
  type CommunityPostWithAuthor,
} from "@/lib/community-service";
import { colors, radius, shadows, spacing, typography } from "@/theme";

// Mois d'inscription en français (ex. « mars 2026 ») pour la ligne « Membre depuis ».
function memberSince(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/**
 * Profil PUBLIC d'un membre : avatar, badge médecin, statistiques
 * (publications / abonnées / abonnements), bouton Suivre, et ses publications
 * non anonymes. Accessible en touchant l'avatar ou le nom d'un auteur dans le fil.
 * Les posts anonymes ne mènent JAMAIS ici (user_id null dans la vue sécurisée).
 */
export default function CommunityProfile() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const toast = useToast();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<CommunityPostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [p, userPosts] = await Promise.all([
        communityService.getPublicProfile(userId),
        communityService.getUserPosts(userId),
      ]);
      setProfile(p);
      setPosts(userPosts);
    } catch {
      setProfile(null);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // Suivre / ne plus suivre — OPTIMISTE : l'UI bascule immédiatement,
  // la RPC confirme, retour arrière en cas d'échec.
  async function onToggleFollow() {
    if (!profile || followBusy) return;
    hapticLight();
    setFollowBusy(true);
    const prev = profile;
    setProfile({
      ...profile,
      isFollowedByMe: !profile.isFollowedByMe,
      followersCount: profile.followersCount + (profile.isFollowedByMe ? -1 : 1),
    });
    try {
      const { following, followersCount } = await communityService.toggleFollow(profile.id);
      setProfile((p) => (p ? { ...p, isFollowedByMe: following, followersCount } : p));
      toast.success(following ? "Tu suis maintenant ce membre 💚" : "Tu ne suis plus ce membre.");
    } catch (e) {
      setProfile(prev);
      toast.error(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setFollowBusy(false);
    }
  }

  if (loading) return <Loading />;

  if (!profile) {
    return (
      <Screen>
        <ScreenHeader title="Profil" />
        <EmptyState
          icon="person-outline"
          title="Profil introuvable"
          message="Ce membre n'existe plus ou n'est pas accessible."
        />
      </Screen>
    );
  }

  const name = profile.full_name?.trim() || "Utilisatrice";

  return (
    <Screen>
      <ScreenHeader title="Profil" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Carte identité : avatar, nom + badge, membre depuis, stats, action Suivre. */}
        <FadeInView fill={false}>
          <Card style={styles.idCard}>
            <Avatar uri={profile.avatar_url} name={name} size={72} />
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              {profile.isVerifiedDoctor ? <VerifiedDoctorBadge specialty={profile.doctorSpecialty ?? undefined} /> : null}
            </View>
            <Text style={styles.since}>Membre depuis {memberSince(profile.created_at)}</Text>

            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{profile.postsCount}</Text>
                <Text style={styles.statLabel}>Publication{profile.postsCount > 1 ? "s" : ""}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statNum}>{profile.followersCount}</Text>
                <Text style={styles.statLabel}>Abonnée{profile.followersCount > 1 ? "s" : ""}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statNum}>{profile.followingCount}</Text>
                <Text style={styles.statLabel}>Abonnements</Text>
              </View>
            </View>

            {!profile.isMe ? (
              <Pressable
                onPress={onToggleFollow}
                disabled={followBusy}
                style={({ pressed }) => [
                  styles.followBtn,
                  profile.isFollowedByMe && styles.followBtnOn,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={profile.isFollowedByMe ? `Ne plus suivre ${name}` : `Suivre ${name}`}
              >
                <Ionicons
                  name={profile.isFollowedByMe ? "checkmark" : "person-add-outline"}
                  size={16}
                  color={profile.isFollowedByMe ? colors.white : colors.primary}
                />
                <Text style={[styles.followBtnText, profile.isFollowedByMe && styles.followBtnTextOn]}>
                  {profile.isFollowedByMe ? "Suivi" : "Suivre"}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.meHint}>C'est toi ✨</Text>
            )}
          </Card>
        </FadeInView>

        {/* Ses publications publiques (les posts anonymes n'apparaissent jamais ici). */}
        <Text style={styles.sectionTitle}>Publications</Text>
        {posts.length === 0 ? (
          <EmptyState
            emoji="💬"
            title="Aucune publication"
            message="Ce membre n'a encore rien publié publiquement."
          />
        ) : (
          posts.map((post) => (
            <FadeInView key={post.id} fill={false}>
              <Card onPress={() => router.push(`/(user)/community/${post.id}`)} accessibilityLabel="Ouvrir la publication" style={styles.post}>
                <View style={styles.postMeta}>
                  <Text style={styles.time}>{formatRelativeTime(post.created_at)}</Text>
                  {post.category ? (
                    <View style={styles.catChip}>
                      <Text style={styles.catChipText}>{categoryLabel(post.category)}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.body} numberOfLines={4}>{post.content}</Text>
                <View style={styles.postFoot}>
                  <View style={styles.footItem}>
                    <Ionicons name="heart" size={14} color={colors.danger} />
                    <Text style={styles.footCount}>{post.likes_count}</Text>
                  </View>
                  <View style={styles.footItem}>
                    <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.footCount}>{post.comments_count}</Text>
                  </View>
                </View>
              </Card>
            </FadeInView>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl, gap: spacing.md },
  pressed: { opacity: 0.7 },
  // Carte identité centrée, fond légèrement teinté (douceur premium).
  idCard: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.lg },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap", justifyContent: "center", marginTop: spacing.xs },
  name: { ...typography.h2 },
  since: { ...typography.caption, color: colors.textMuted },
  stats: { flexDirection: "row", alignItems: "center", marginTop: spacing.md },
  stat: { alignItems: "center", paddingHorizontal: spacing.lg },
  statNum: { fontSize: 17, fontWeight: "800", color: colors.text },
  statLabel: { ...typography.caption, fontSize: 11.5, color: colors.textMuted, fontWeight: "600" },
  statDivider: { width: 1, height: 26, backgroundColor: colors.border },
  followBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
    borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.white,
  },
  followBtnOn: { backgroundColor: colors.primary, ...shadows.sm },
  followBtnText: { fontSize: 14, fontWeight: "800", color: colors.primary },
  followBtnTextOn: { color: colors.white },
  meHint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md },
  sectionTitle: {
    ...typography.caption, color: colors.textMuted, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.4, marginTop: spacing.xs,
  },
  post: { gap: spacing.sm },
  postMeta: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  time: { ...typography.caption, color: colors.textMuted },
  catChip: { backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.pill },
  catChipText: { ...typography.caption, fontSize: 11, color: colors.primaryDark, fontWeight: "700" },
  body: { ...typography.body, color: colors.text, lineHeight: 21 },
  postFoot: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  footItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  footCount: { ...typography.caption, color: colors.textMuted, fontWeight: "700" },
});
