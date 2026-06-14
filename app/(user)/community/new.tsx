import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Loading } from "@/components/Loading";
import { useAuth } from "@/providers/AuthProvider";
import { authService } from "@/lib/auth-service";
import { communityService, COMMUNITY_CATEGORIES, DEFAULT_CATEGORY, categoryLabel } from "@/lib/community-service";
import { CommunityRules } from "@/components/CommunityRules";
import { useToast } from "@/providers/ToastProvider";
import { uploadCommunityImage } from "@/lib/storage";
import { colors, radius, spacing, typography } from "@/theme";

export default function NewPost() {
  const { session, profile, refreshProfile } = useAuth();
  const router = useRouter();
  // En mode édition, `id` est l'id du post à modifier (sinon création).
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const toast = useToast();

  // Acceptation de la charte requise avant la 1ʳᵉ publication (pas en édition).
  const needsRules = !isEdit && profile?.community_rules_accepted === false;
  const [accepting, setAccepting] = useState(false);

  const MAX_IMAGES = 4;
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORY);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [images, setImages] = useState<string[]>([]); // URLs déjà uploadées
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingPost, setLoadingPost] = useState(isEdit);

  // Édition : charge le post existant et préremplit le formulaire.
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const p = await communityService.getPost(id!);
        if (p) {
          setContent(p.content);
          setCategory(p.category ?? DEFAULT_CATEGORY);
          setIsAnonymous(p.is_anonymous);
          // Reprend image_urls, sinon repli sur l'ancienne image unique.
          setImages(p.image_urls ?? (p.image_url ? [p.image_url] : []));
        }
      } catch {
        Alert.alert("Erreur", "Publication introuvable.", [{ text: "OK", onPress: () => router.back() }]);
      } finally {
        setLoadingPost(false);
      }
    })();
  }, [isEdit, id]);

  // Sélection de PLUSIEURS photos (jusqu'à 4) + upload de chacune.
  async function pickImages() {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) { Alert.alert("Limite atteinte", `Vous pouvez ajouter jusqu'à ${MAX_IMAGES} photos.`); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Autorisation requise", "Autorisez l'accès à vos photos pour ajouter des images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      allowsEditing: false,
      quality: 1,
      base64: true,
    });
    if (result.canceled) return;
    const assets = result.assets.slice(0, remaining).filter((a) => a.base64);
    if (assets.length === 0) { Alert.alert("Erreur", "Impossible de lire les photos sélectionnées."); return; }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const a of assets) {
        urls.push(await uploadCommunityImage(a.base64!));
      }
      setImages((prev) => [...prev, ...urls].slice(0, MAX_IMAGES));
    } catch (e) {
      Alert.alert("Échec de l'upload", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  // Accepte la charte → on ne la redemandera plus.
  async function acceptRules() {
    if (!session?.user) return;
    setAccepting(true);
    try {
      await authService.updateProfile(session.user.id, { community_rules_accepted: true });
      await refreshProfile();
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Action impossible");
    } finally {
      setAccepting(false);
    }
  }

  async function handlePublish() {
    if (!session?.user) return;
    if (needsRules) { Alert.alert("Règles à accepter", "Veuillez accepter les règles de la communauté avant de publier."); return; }
    if (uploading) { Alert.alert("Patientez", "Les photos sont encore en cours d'envoi."); return; }
    const text = content.trim();
    if (!text) {
      Alert.alert("Publication vide", "Écrivez quelque chose avant de publier.");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await communityService.updatePost(id!, {
          content: text,
          category,
          imageUrls: images,
        });
        toast.success("Publication modifiée.");
        router.back();
      } else {
        await communityService.createPost({
          userId: session.user.id,
          content: text,
          isAnonymous,
          category,
          imageUrls: images,
        });
        toast.success("Votre publication a été partagée.");
        router.back();
      }
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Publication échouée");
    } finally {
      setSaving(false);
    }
  }

  if (loadingPost) return <Loading />;

  return (
    <Screen>
      <ScreenHeader title={isEdit ? "Modifier la publication" : "Nouvelle publication"} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {needsRules ? (
          <Card style={styles.rulesCard}>
            <Text style={styles.rulesTitle}>Avant de publier</Text>
            <Text style={styles.rulesIntro}>Merci de lire et d'accepter les règles de la communauté.</Text>
            <CommunityRules />
            <Button title="J'accepte les règles de la communauté" onPress={acceptRules} loading={accepting} />
          </Card>
        ) : null}

        <Input
          label="Votre message"
          value={content}
          onChangeText={setContent}
          placeholder="Partagez votre expérience, posez une question…"
          multiline
          numberOfLines={6}
          style={styles.textArea}
        />

        <Text style={styles.catLabel}>Catégorie</Text>
        <View style={styles.chips}>
          {COMMUNITY_CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{categoryLabel(c)}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Photos optionnelles (jusqu'à 4) */}
        <Text style={styles.catLabel}>Photos (facultatif, jusqu'à {MAX_IMAGES})</Text>
        {images.length > 0 ? (
          <View style={styles.thumbGrid}>
            {images.map((url, i) => (
              <View key={url} style={styles.thumbWrap}>
                <Image source={{ uri: url }} style={styles.thumb} resizeMode="cover" />
                <Pressable onPress={() => removeImage(i)} hitSlop={6} style={styles.thumbRemove} accessibilityRole="button" accessibilityLabel="Retirer cette photo">
                  <Ionicons name="close" size={14} color={colors.white} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        {uploading ? (
          <View style={styles.uploadRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.uploadText}>Envoi des photos…</Text>
          </View>
        ) : null}
        {images.length < MAX_IMAGES ? (
          <View style={styles.photoActions}>
            <Pressable onPress={pickImages} disabled={uploading} style={[styles.photoBtn, uploading && styles.photoBtnDisabled]}>
              <Ionicons name="image" size={18} color={colors.primary} />
              <Text style={styles.photoBtnText}>{images.length > 0 ? "Ajouter des photos" : "Ajouter des photos"}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* L'anonymat est défini à la création (non modifiable ensuite). */}
        {!isEdit ? (
          <Card style={styles.anonRow}>
            <View style={styles.anonIcon}>
              <Ionicons name="eye-off-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.anonText}>
              <Text style={styles.anonTitle}>Publier anonymement</Text>
              <Text style={styles.anonHint}>Votre nom sera masqué et remplacé par « Anonyme ».</Text>
            </View>
            <Switch
              value={isAnonymous}
              onValueChange={setIsAnonymous}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </Card>
        ) : null}

        <Button title={isEdit ? "Enregistrer" : "Publier"} onPress={handlePublish} loading={saving} disabled={uploading || needsRules} />
        <Button title="Annuler" variant="outline" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  rulesCard: { gap: spacing.md, marginBottom: spacing.sm },
  rulesTitle: { ...typography.h3 },
  rulesIntro: { ...typography.caption, color: colors.textMuted, marginTop: -spacing.xs },
  textArea: { height: 140, textAlignVertical: "top", paddingTop: spacing.sm },
  catLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "700", marginTop: spacing.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, fontWeight: "700", color: colors.text },
  chipTextActive: { color: colors.white },
  thumbGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.xs },
  thumbWrap: { width: "48%", aspectRatio: 1, position: "relative" },
  thumb: { width: "100%", height: "100%", borderRadius: radius.md, backgroundColor: colors.surface },
  thumbRemove: { position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  uploadRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  uploadText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  photoActions: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  photoBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary },
  photoBtnDisabled: { opacity: 0.5 },
  photoBtnText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  anonRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  anonIcon: {
    width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  anonText: { flex: 1, gap: 2 },
  anonTitle: { ...typography.name },
  anonHint: { ...typography.caption, color: colors.textMuted },
});
