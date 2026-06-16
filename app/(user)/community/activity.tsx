import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonList } from "@/components/Skeleton";
import { FadeInView } from "@/components/FadeInView";
import { CategoryTag } from "@/components/CommunityBadges";
import { communityService, formatRelativeTime, type MyComment } from "@/lib/community-service";
import { hapticLight } from "@/lib/haptics";
import type { CommunityPost, CommunityPostSafe } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

type Tab = "posts" | "comments" | "likes";
const TABS: { key: Tab; label: string }[] = [
  { key: "posts", label: "Mes publications" },
  { key: "comments", label: "Mes commentaires" },
  { key: "likes", label: "Mes réactions" },
];

export default function CommunityActivity() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("posts");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [comments, setComments] = useState<MyComment[]>([]);
  const [likes, setLikes] = useState<CommunityPostSafe[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c, l] = await Promise.all([
        communityService.getMyPosts(),
        communityService.getMyComments(),
        communityService.getMyLikes(),
      ]);
      setPosts(p); setComments(c); setLikes(l);
    } catch {
      setPosts([]); setComments([]); setLikes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = (id: string) => router.push(`/(user)/community/${id}`);

  return (
    <Screen>
      <FadeInView>
        <ScreenHeader title="Mon activité" />

        <View style={styles.segment}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable key={t.key} onPress={() => { hapticLight(); setTab(t.key); }} style={({ pressed }) => [styles.segBtn, active && styles.segBtnActive, pressed && styles.segPressed]}>
                <Text style={[styles.segText, active && styles.segTextActive]} numberOfLines={1}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <SkeletonList variant="post" />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {tab === "posts" ? (
              posts.length === 0 ? (
                <EmptyState emoji="📝" title="Aucune publication" message="Tes publications apparaîtront ici." />
              ) : (
                posts.map((p) => (
                  <Card key={p.id} onPress={() => open(p.id)} haptic style={styles.card}>
                    <View style={styles.cardHead}>
                      {p.is_anonymous ? <Text style={styles.anon}>Anonyme</Text> : null}
                      <CategoryTag category={p.category} />
                      <Text style={styles.time}>{formatRelativeTime(p.created_at)}</Text>
                    </View>
                    <Text style={styles.body} numberOfLines={3}>{p.content}</Text>
                    <View style={styles.metaRow}>
                      <Ionicons name="heart-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.metaText}>{p.likes_count}</Text>
                      <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} style={styles.metaIcon} />
                      <Text style={styles.metaText}>{p.comments_count}</Text>
                    </View>
                  </Card>
                ))
              )
            ) : null}

            {tab === "comments" ? (
              comments.length === 0 ? (
                <EmptyState emoji="💬" title="Aucun commentaire" message="Tes commentaires apparaîtront ici." />
              ) : (
                comments.map((c) => (
                  <Card key={c.id} onPress={() => open(c.post_id)} haptic style={styles.card}>
                    <Text style={styles.body} numberOfLines={3}>{c.content}</Text>
                    {c.postExcerpt ? (
                      <Text style={styles.onPost} numberOfLines={1}>Sur : {c.postExcerpt}</Text>
                    ) : null}
                    <Text style={styles.time}>{formatRelativeTime(c.created_at)}</Text>
                  </Card>
                ))
              )
            ) : null}

            {tab === "likes" ? (
              likes.length === 0 ? (
                <EmptyState emoji="💗" title="Aucune réaction" message="Les publications que tu aimes apparaîtront ici." />
              ) : (
                likes.map((p) => (
                  <Card key={p.id} onPress={() => open(p.id)} haptic style={styles.card}>
                    <View style={styles.cardHead}>
                      <CategoryTag category={p.category} />
                      <Text style={styles.time}>{formatRelativeTime(p.created_at)}</Text>
                    </View>
                    <Text style={styles.body} numberOfLines={3}>{p.content}</Text>
                  </Card>
                ))
              )
            ) : null}
          </ScrollView>
        )}
      </FadeInView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm, marginBottom: spacing.xs },
  segBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: "center" },
  segBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segPressed: { opacity: 0.7 },
  segText: { fontSize: 12, fontWeight: "700", color: colors.text },
  segTextActive: { color: colors.white },
  content: { paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { gap: spacing.xs },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  anon: { ...typography.caption, color: colors.textMuted, fontWeight: "700" },
  time: { ...typography.caption, color: colors.textMuted, marginLeft: "auto" },
  body: { ...typography.body, color: colors.text, lineHeight: 21 },
  onPost: { ...typography.caption, color: colors.textMuted, fontStyle: "italic" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  metaText: { ...typography.caption, color: colors.textMuted },
  metaIcon: { marginLeft: spacing.sm },
});
