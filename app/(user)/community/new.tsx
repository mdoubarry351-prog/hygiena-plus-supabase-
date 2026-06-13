import { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/providers/AuthProvider";
import { communityService, COMMUNITY_CATEGORIES, DEFAULT_CATEGORY, categoryLabel } from "@/lib/community-service";
import { uploadCommunityImage } from "@/lib/storage";
import { colors, radius, spacing, typography } from "@/theme";

export default function NewPost() {
  const { session } = useAuth();
  const router = useRouter();

  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORY);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const previewUri = localPreview ?? (imageUrl || null);

  // Sélection d'une photo (optionnelle) + upload dans community-images.
  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Autorisation requise", "Autorisez l'accès à vos photos pour ajouter une image.");
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
      setImageUrl(await uploadCommunityImage(asset.base64));
    } catch (e) {
      setLocalPreview(null);
      Alert.alert("Échec de l'upload", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto() {
    setImageUrl("");
    setLocalPreview(null);
  }

  async function handlePublish() {
    if (!session?.user) return;
    if (uploading) { Alert.alert("Patientez", "La photo est encore en cours d'envoi."); return; }
    const text = content.trim();
    if (!text) {
      Alert.alert("Publication vide", "Écrivez quelque chose avant de publier.");
      return;
    }
    setSaving(true);
    try {
      await communityService.createPost({
        userId: session.user.id,
        content: text,
        isAnonymous,
        category,
        imageUrl: imageUrl.trim() || null,
      });
      Alert.alert("Publié", "Votre publication a été partagée.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Publication échouée");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Nouvelle publication" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

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

        {/* Photo optionnelle */}
        <Text style={styles.catLabel}>Photo (facultatif)</Text>
        {previewUri ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover" />
            {uploading && (
              <View style={styles.previewOverlay}>
                <ActivityIndicator color={colors.white} />
                <Text style={styles.previewOverlayText}>Envoi…</Text>
              </View>
            )}
          </View>
        ) : null}
        <View style={styles.photoActions}>
          <Pressable onPress={pickImage} disabled={uploading} style={[styles.photoBtn, uploading && styles.photoBtnDisabled]}>
            <Ionicons name="image" size={18} color={colors.primary} />
            <Text style={styles.photoBtnText}>{previewUri ? "Changer la photo" : "Ajouter une photo"}</Text>
          </Pressable>
          {previewUri && !uploading ? (
            <Pressable onPress={removePhoto} style={[styles.photoBtn, styles.photoBtnDanger]}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={[styles.photoBtnText, { color: colors.danger }]}>Retirer</Text>
            </Pressable>
          ) : null}
        </View>

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

        <Button title="Publier" onPress={handlePublish} loading={saving} disabled={uploading} />
        <Button title="Annuler" variant="outline" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  textArea: { height: 140, textAlignVertical: "top", paddingTop: spacing.sm },
  catLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "700", marginTop: spacing.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, fontWeight: "700", color: colors.text },
  chipTextActive: { color: colors.white },
  previewWrap: { position: "relative", marginBottom: spacing.xs },
  preview: { width: "100%", height: 200, borderRadius: radius.md, backgroundColor: colors.surface },
  previewOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: radius.md, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  previewOverlayText: { ...typography.caption, color: colors.white, fontWeight: "700" },
  photoActions: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  photoBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary },
  photoBtnDisabled: { opacity: 0.5 },
  photoBtnDanger: { borderColor: colors.danger },
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
