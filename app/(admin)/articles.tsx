import { useEffect, useState, useCallback } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";
import { AppImage } from "@/components/AppImage";
import { useAuth } from "@/providers/AuthProvider";
import { adminService } from "@/lib/admin-service";
import { ARTICLE_CATEGORIES } from "@/lib/articles-service";
import { uploadArticleImage } from "@/lib/storage";
import { hapticSuccess } from "@/lib/haptics";
import type { Article } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

type Editing = Article | "new" | null;

export default function AdminArticles() {
  const { session } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Editing>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setArticles(await adminService.getAllArticles());
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function togglePublished(article: Article) {
    if (!session?.user) return;
    const next = !article.is_published;
    setArticles((prev) => prev.map((a) => (a.id === article.id ? { ...a, is_published: next } : a)));
    try {
      await adminService.setArticlePublished(session.user.id, article.id, next);
    } catch (e) {
      setArticles((prev) => prev.map((a) => (a.id === article.id ? { ...a, is_published: article.is_published } : a)));
      Alert.alert("Erreur", e instanceof Error ? e.message : "Action échouée");
    }
  }

  function confirmDelete(article: Article) {
    if (!session?.user) return;
    Alert.alert(
      "Supprimer cet article ?",
      `« ${article.title} » sera définitivement supprimé.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await adminService.deleteArticle(session.user.id, article.id);
              setArticles((prev) => prev.filter((a) => a.id !== article.id));
            } catch (e) {
              Alert.alert("Erreur", e instanceof Error ? e.message : "Suppression échouée");
            }
          },
        },
      ]
    );
  }

  if (loading && articles.length === 0) return <Loading />;

  if (editing) {
    return (
      <ArticleForm
        article={editing === "new" ? null : editing}
        onDone={async () => { setEditing(null); await load(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <Screen>
      <AdminHeader
        title="Articles"
        right={
          <Pressable onPress={() => setEditing("new")} hitSlop={8} style={styles.addBtn} accessibilityRole="button" accessibilityLabel="Nouvel article">
            <Ionicons name="add" size={20} color={colors.white} />
          </Pressable>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {articles.length === 0 ? (
          <EmptyState icon="document-text-outline" title="Aucun article" message="Touchez + pour en créer un." />
        ) : (
          articles.map((a) => (
            <Card key={a.id} style={styles.row}>
              <Pressable style={styles.rowMain} onPress={() => setEditing(a)}>
                {a.cover_image_url ? (
                  <AppImage source={a.cover_image_url} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Ionicons name="document-text-outline" size={22} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.rowInfo}>
                  <Text style={styles.title} numberOfLines={1}>{a.title}</Text>
                  <Text style={styles.category}>{a.category}</Text>
                  <Text style={[styles.badge, a.is_published ? styles.badgeOn : styles.badgeOff]}>
                    {a.is_published ? "Publié" : "Brouillon"}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.rowActions}>
                <Switch
                  value={a.is_published}
                  onValueChange={() => togglePublished(a)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.white}
                />
                <Pressable onPress={() => confirmDelete(a)} hitSlop={8} style={styles.deleteBtn} accessibilityRole="button" accessibilityLabel={`Supprimer ${a.title}`}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function ArticleForm({ article, onDone, onCancel }: { article: Article | null; onDone: () => void; onCancel: () => void }) {
  const { session } = useAuth();
  const [title, setTitle] = useState(article?.title ?? "");
  const [category, setCategory] = useState<string>(article?.category ?? ARTICLE_CATEGORIES[0]);
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");
  const [content, setContent] = useState(article?.content ?? "");
  const [coverUrl, setCoverUrl] = useState(article?.cover_image_url ?? "");
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isPublished, setIsPublished] = useState(article?.is_published ?? false);
  const [saving, setSaving] = useState(false);

  const previewUri = localPreview ?? (coverUrl || null);

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Autorisation requise", "Autorisez l'accès à vos photos pour ajouter une image de couverture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) { Alert.alert("Erreur", "Impossible de lire la photo sélectionnée."); return; }
    setLocalPreview(asset.uri);
    setUploading(true);
    try {
      setCoverUrl(await uploadArticleImage(asset.base64));
    } catch (e) {
      setLocalPreview(null);
      Alert.alert("Échec de l'upload", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto() {
    setCoverUrl("");
    setLocalPreview(null);
  }

  async function handleSave() {
    if (!session?.user) return;
    if (uploading) { Alert.alert("Patientez", "L'image est encore en cours d'envoi."); return; }
    if (!title.trim()) { Alert.alert("Titre requis", "Indiquez le titre de l'article."); return; }
    if (!content.trim()) { Alert.alert("Contenu requis", "Rédigez le contenu de l'article."); return; }

    const input = {
      title: title.trim(),
      category,
      excerpt: excerpt.trim() || null,
      content: content.trim(),
      coverImageUrl: coverUrl.trim() || null,
      isPublished,
    };

    setSaving(true);
    try {
      if (article) {
        await adminService.updateArticle(session.user.id, article.id, input);
      } else {
        await adminService.createArticle(session.user.id, input);
      }
      hapticSuccess();
      onDone();
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Enregistrement échoué");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <AdminHeader title={article ? "Modifier l'article" : "Nouvel article"} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>
        <Input label="Titre" value={title} onChangeText={setTitle} placeholder="Titre de l'article" />

        <Text style={styles.fieldLabel}>Catégorie</Text>
        <View style={styles.chips}>
          {ARTICLE_CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        <Input label="Extrait (facultatif)" value={excerpt} onChangeText={setExcerpt} placeholder="Court résumé affiché dans la liste" multiline numberOfLines={2} style={styles.textAreaSm} />
        <Input label="Contenu" value={content} onChangeText={setContent} placeholder="Texte de l'article…" multiline numberOfLines={10} style={styles.textArea} />

        <View style={styles.photoBlock}>
          <Text style={styles.photoLabel}>Image de couverture (facultatif)</Text>
          {previewUri ? (
            <View style={styles.previewWrap}>
              <AppImage source={previewUri} style={styles.preview} />
              {uploading && (
                <View style={styles.previewOverlay}>
                  <ActivityIndicator color={colors.white} />
                  <Text style={styles.previewOverlayText}>Envoi…</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.preview, styles.previewPlaceholder]}>
              <Ionicons name="image-outline" size={44} color={colors.textMuted} />
            </View>
          )}
          <View style={styles.photoActions}>
            <Pressable onPress={pickImage} disabled={uploading} style={[styles.photoBtn, uploading && styles.photoBtnDisabled]}>
              <Ionicons name="image" size={18} color={colors.primary} />
              <Text style={styles.photoBtnText}>{previewUri ? "Changer l'image" : "Choisir une image"}</Text>
            </Pressable>
            {previewUri && !uploading ? (
              <Pressable onPress={removePhoto} style={[styles.photoBtn, styles.photoBtnDanger]}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={[styles.photoBtnText, { color: colors.danger }]}>Retirer</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.activeRow}>
          <Text style={styles.activeLabel}>Publié</Text>
          <Switch value={isPublished} onValueChange={setIsPublished} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
        </View>

        <Button title={article ? "Enregistrer" : "Créer l'article"} onPress={handleSave} loading={saving} disabled={uploading} />
        <Button title="Annuler" variant="outline" onPress={onCancel} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  addBtn: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surface },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1, gap: 2 },
  title: { ...typography.name },
  category: { ...typography.caption, color: colors.secondary, fontWeight: "600" },
  badge: { ...typography.caption, fontWeight: "700", alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.pill, overflow: "hidden", marginTop: 2 },
  badgeOn: { backgroundColor: colors.primaryLight, color: colors.primaryDark },
  badgeOff: { backgroundColor: colors.surface, color: colors.textMuted },
  rowActions: { alignItems: "center", gap: spacing.xs },
  deleteBtn: { padding: spacing.xs },
  // Formulaire
  formContent: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  fieldLabel: { ...typography.caption, color: colors.text, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, fontWeight: "700", color: colors.text },
  chipTextActive: { color: colors.white },
  textAreaSm: { height: 64, textAlignVertical: "top", paddingTop: spacing.sm },
  textArea: { height: 200, textAlignVertical: "top", paddingTop: spacing.sm },
  photoBlock: { gap: spacing.sm },
  photoLabel: { ...typography.caption, color: colors.text, fontWeight: "700" },
  previewWrap: { position: "relative" },
  preview: { width: "100%", height: 180, borderRadius: radius.md, backgroundColor: colors.surface },
  previewPlaceholder: { alignItems: "center", justifyContent: "center" },
  previewOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: radius.md, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  previewOverlayText: { ...typography.caption, color: colors.white, fontWeight: "700" },
  photoActions: { flexDirection: "row", gap: spacing.sm },
  photoBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary },
  photoBtnDisabled: { opacity: 0.5 },
  photoBtnDanger: { borderColor: colors.danger },
  photoBtnText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  activeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  activeLabel: { ...typography.name },
});
