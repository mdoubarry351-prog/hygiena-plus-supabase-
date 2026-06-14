import { useEffect, useMemo, useState, useCallback } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { SkeletonList } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { AppImage } from "@/components/AppImage";
import { articlesService, ARTICLE_CATEGORIES } from "@/lib/articles-service";
import type { Article } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

// « Toutes » + les catégories fixes, pour les chips de filtre.
const FILTERS = ["Toutes", ...ARTICLE_CATEGORIES] as const;

export default function Library() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("Toutes");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setArticles(await articlesService.getPublishedArticles());
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // Filtre catégorie + recherche titre, sur le jeu chargé.
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return articles
      .filter((a) => filter === "Toutes" || a.category === filter)
      .filter((a) => !q || a.title.toLowerCase().includes(q));
  }, [articles, filter, search]);

  if (loading && articles.length === 0) return <SkeletonList variant="article" />;

  return (
    <Screen>
      <ScreenHeader title="Conseils & infos" />
      <View style={styles.searchRow}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un article…"
          autoCapitalize="none"
          style={styles.searchInput}
        />
      </View>

      {/* Chips de filtre par catégorie */}
      <View style={styles.chipsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((c) => {
            const active = filter === c;
            return (
              <Pressable key={c} onPress={() => setFilter(c)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {list.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title={search.trim() || filter !== "Toutes" ? "Aucun article" : "Bientôt disponible"}
            message={search.trim() || filter !== "Toutes" ? "Aucun article ne correspond à votre recherche." : "De nouveaux articles arrivent bientôt."}
          />
        ) : (
          list.map((a) => (
            <Pressable key={a.id} onPress={() => router.push({ pathname: "/(user)/article", params: { id: a.id } })}>
              <Card style={styles.card}>
                {a.cover_image_url ? (
                  <AppImage source={a.cover_image_url} style={styles.cover} />
                ) : null}
                <View style={styles.cardBody}>
                  <Text style={styles.category}>{a.category}</Text>
                  <Text style={styles.title} numberOfLines={2}>{a.title}</Text>
                  {a.excerpt ? <Text style={styles.excerpt} numberOfLines={3}>{a.excerpt}</Text> : null}
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { paddingTop: spacing.sm },
  searchInput: { marginBottom: 0 },
  chipsWrap: { paddingVertical: spacing.sm },
  chips: { gap: spacing.xs, paddingRight: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, fontWeight: "700", color: colors.text },
  chipTextActive: { color: colors.white },
  content: { paddingBottom: spacing.xxl, gap: spacing.md },
  card: { padding: 0, overflow: "hidden", gap: 0 },
  cover: { width: "100%", height: 160, backgroundColor: colors.surface },
  cardBody: { padding: spacing.md, gap: spacing.xs },
  category: { ...typography.caption, color: colors.secondary, fontWeight: "700" },
  title: { ...typography.h3 },
  excerpt: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
});
