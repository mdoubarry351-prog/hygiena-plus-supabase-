import { useEffect, useState, useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Loading } from "@/components/Loading";
import { EmptyState } from "@/components/EmptyState";
import { AppImage } from "@/components/AppImage";
import { articlesService } from "@/lib/articles-service";
import type { Article } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

export default function ArticleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    try {
      setArticle(await articlesService.getArticle(id));
    } catch {
      setArticle(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loading />;

  if (!article) {
    return (
      <Screen>
        <ScreenHeader title="Article" />
        <EmptyState icon="document-text-outline" title="Article introuvable" message="Ce contenu n'est plus disponible." />
      </Screen>
    );
  }

  // Rendu léger : on découpe le contenu en paragraphes (lignes vides) et on
  // conserve les retours à la ligne simples à l'intérieur de chaque paragraphe.
  const paragraphs = article.content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <Screen>
      <ScreenHeader title="Article" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {article.cover_image_url ? (
          <AppImage source={article.cover_image_url} style={styles.cover} />
        ) : null}
        <Text style={styles.category}>{article.category}</Text>
        <Text style={styles.title}>{article.title}</Text>
        {article.excerpt ? <Text style={styles.excerpt}>{article.excerpt}</Text> : null}
        <View style={styles.body}>
          {paragraphs.map((p, i) => (
            <Text key={i} style={styles.paragraph}>{p}</Text>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl, gap: spacing.sm },
  cover: { width: "100%", height: 200, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: spacing.sm },
  category: { ...typography.caption, color: colors.secondary, fontWeight: "700" },
  title: { ...typography.h2 },
  excerpt: { ...typography.body, color: colors.textMuted, fontStyle: "italic" },
  body: { gap: spacing.md, marginTop: spacing.sm },
  paragraph: { ...typography.body, lineHeight: 23, color: colors.text },
});
