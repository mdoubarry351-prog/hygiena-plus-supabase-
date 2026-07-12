import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";
import { AppImage } from "@/components/AppImage";
import { FadeInView } from "@/components/FadeInView";
import { ActionSheet, type ActionSheetOption } from "@/components/ActionSheet";
import { useAuth } from "@/providers/AuthProvider";
import { authService } from "@/lib/auth-service";
import { communityService, COMMUNITY_CATEGORIES, DEFAULT_CATEGORY, categoryLabel, authorDisplayName } from "@/lib/community-service";
import { VerifiedDoctorBadge, CategoryTag } from "@/components/CommunityBadges";
import { PostImages } from "@/components/PostImages";
import { CommunityRules } from "@/components/CommunityRules";
import { useToast } from "@/providers/ToastProvider";
import { useConfirm } from "@/components/ConfirmDialog";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { uploadCommunityImage } from "@/lib/storage";
import { getDraft, setDraft, clearDraft, DRAFT_KEYS } from "@/lib/draft";
import { colors, fonts, radius, spacing, typography } from "@/theme";

// Brouillon local (création uniquement) : texte + catégorie. PAS les images
// (les URIs/URLs ne sont pas pertinentes à persister comme brouillon).
type PostDraft = { content: string; category: string };

export default function NewPost() {
  const { session, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // En mode édition, `id` est l'id du post à modifier (sinon création).
  // `anonymous` / `photo` : raccourcis du composeur du fil (mode anonyme
  // pré-coché / sélecteur de photos ouvert à l'arrivée).
  const { id, anonymous, photo, category: categoryParam } = useLocalSearchParams<{ id?: string; anonymous?: string; photo?: string; category?: string }>();
  const isEdit = !!id;
  const toast = useToast();
  const confirm = useConfirm();

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
  const [showPreview, setShowPreview] = useState(false);
  const [showCatSheet, setShowCatSheet] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  // Vrai une fois la restauration du brouillon tentée (évite d'écraser au montage).
  const hydrated = useRef(false);
  // Spécialité de l'utilisatrice si elle est médecin VALIDÉE (badge dans l'aperçu).
  const [myDoctorSpecialty, setMyDoctorSpecialty] = useState<string | null>(null);
  const [isVerifiedDoctor, setIsVerifiedDoctor] = useState(false);

  // Statut « médecin vérifié » de l'utilisatrice (pour l'aperçu).
  useEffect(() => {
    if (!session?.user) return;
    let alive = true;
    (async () => {
      const info = await communityService.getVerifiedDoctorInfo(session.user.id);
      if (alive && info) { setIsVerifiedDoctor(true); setMyDoctorSpecialty(info.specialty); }
    })();
    return () => { alive = false; };
  }, [session?.user]);

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
        toast.error("Publication introuvable.");
        router.back();
      } finally {
        setLoadingPost(false);
      }
    })();
  }, [isEdit, id]);

  // Restauration du brouillon au montage — CRÉATION uniquement (jamais en édition,
  // pour ne pas écraser le contenu d'une publication existante).
  useEffect(() => {
    if (isEdit) { hydrated.current = true; return; }
    let alive = true;
    (async () => {
      const d = await getDraft<PostDraft>(DRAFT_KEYS.communityPost);
      if (alive && d && d.content?.trim()) {
        setContent(d.content);
        if (d.category) setCategory(d.category);
        setDraftRestored(true);
      }
      if (alive) hydrated.current = true;
    })();
    return () => { alive = false; };
  }, [isEdit]);

  // Raccourcis du composeur (création uniquement) : « Anonyme » pré-coche le
  // mode anonyme ; « Photo » ouvre le sélecteur d'images ; « Catégorie » ouvre
  // directement le sélecteur de catégorie.
  const shortcutDone = useRef(false);
  useEffect(() => {
    if (isEdit || needsRules || shortcutDone.current) return;
    shortcutDone.current = true;
    if (anonymous === "1") setIsAnonymous(true);
    if (photo === "1") pickImages();
    if (categoryParam === "1") setShowCatSheet(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, needsRules, anonymous, photo, categoryParam]);

  // Sauvegarde locale auto (debounce léger). Texte vide → on efface le brouillon.
  useEffect(() => {
    if (isEdit || !hydrated.current) return;
    const t = setTimeout(() => {
      if (content.trim()) setDraft<PostDraft>(DRAFT_KEYS.communityPost, { content, category });
      else clearDraft(DRAFT_KEYS.communityPost);
    }, 600);
    return () => clearTimeout(t);
  }, [isEdit, content, category]);

  // Sélection de PLUSIEURS photos (jusqu'à 4) + upload de chacune.
  async function pickImages() {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) { toast.info(`Vous pouvez ajouter jusqu'à ${MAX_IMAGES} photos.`); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error("Autorisez l'accès à vos photos pour ajouter des images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      // iOS : transcode les HEIC en JPEG dès la sélection (formats du bucket).
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      allowsEditing: false,
      quality: 1,
      base64: true,
    });
    if (result.canceled) return;
    const assets = result.assets.slice(0, remaining).filter((a) => a.base64);
    if (assets.length === 0) { toast.error("Impossible de lire les photos sélectionnées."); return; }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const a of assets) {
        urls.push(await uploadCommunityImage(a.base64!));
      }
      setImages((prev) => [...prev, ...urls].slice(0, MAX_IMAGES));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Réessayez.");
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
      toast.error(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setAccepting(false);
    }
  }

  async function handlePublish() {
    if (!session?.user) return;
    if (needsRules) { toast.info("Veuillez accepter les règles de la communauté avant de publier."); return; }
    if (uploading) { toast.info("Les photos sont encore en cours d'envoi."); return; }
    const text = content.trim();
    if (!text) {
      toast.info("Écrivez quelque chose avant de publier.");
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
        hapticSuccess();
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
        clearDraft(DRAFT_KEYS.communityPost); // brouillon consommé
        hapticSuccess();
        toast.success("Ta publication a été partagée.");
        router.back();
      }
    } catch (e) {
      // L'erreur backend (ex. mots interdits) est affichée telle quelle.
      toast.error(e instanceof Error ? e.message : "Publication échouée");
    } finally {
      setSaving(false);
    }
  }

  // Ouvre l'aperçu (mêmes garde-fous que la publication, hors envoi en cours).
  function openPreview() {
    if (needsRules) { toast.info("Veuillez accepter les règles de la communauté avant de publier."); return; }
    if (uploading) { toast.info("Les photos sont encore en cours d'envoi."); return; }
    if (!content.trim()) { toast.info("Écrivez quelque chose avant de prévisualiser."); return; }
    setShowPreview(true);
  }

  // Confirme la publication depuis l'aperçu.
  async function confirmFromPreview() {
    setShowPreview(false);
    await handlePublish();
  }

  // Fermeture : confirmation si du contenu non publié existe.
  async function handleClose() {
    const dirty = content.trim().length > 0 || images.length > 0;
    if (dirty) {
      if (await confirm({
        title: "Quitter sans publier ?",
        message: isEdit ? "Tes modifications ne seront pas enregistrées." : "Ton brouillon reste enregistré sur cet appareil.",
        confirmLabel: "Quitter",
        cancelLabel: "Continuer",
        danger: true,
      })) {
        router.back();
      }
    } else {
      router.back();
    }
  }

  const catOptions: ActionSheetOption[] = COMMUNITY_CATEGORIES.map((c) => ({
    label: categoryLabel(c),
    icon: category === c ? "checkmark-circle" : undefined,
    onPress: () => { hapticLight(); setCategory(c); },
  }));

  const publishDisabled = !content.trim() || uploading || saving || needsRules;

  if (loadingPost) return <Loading />;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Barre du haut minimaliste : ✕ à gauche, « Publier » compact à droite. */}
      <View style={styles.topBar}>
        <Pressable onPress={handleClose} hitSlop={8} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Fermer">
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => { if (!publishDisabled) { hapticLight(); handlePublish(); } }}
          disabled={publishDisabled}
          style={({ pressed }) => [styles.publishBtn, publishDisabled ? styles.publishBtnDisabled : null, pressed && !publishDisabled && styles.publishBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel={isEdit ? "Enregistrer" : "Publier"}
        >
          {saving ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={[styles.publishText, publishDisabled && styles.publishTextDisabled]}>{isEdit ? "Enregistrer" : "Publier"}</Text>}
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={8}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <FadeInView fill={false}>
            {needsRules ? (
              <Card style={styles.rulesCard}>
                <Text style={styles.rulesTitle}>Avant de publier</Text>
                <Text style={styles.rulesIntro}>Merci de lire et d'accepter les règles de la communauté.</Text>
                <CommunityRules />
                <Button title="J'accepte les règles de la communauté" onPress={acceptRules} loading={accepting} />
              </Card>
            ) : null}

            {draftRestored ? (
              <View style={styles.draftRow}>
                <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                <Text style={styles.draftText}>Brouillon restauré</Text>
              </View>
            ) : null}

            {/* Sélecteur de catégorie discret (pastille → ActionSheet). */}
            <Pressable onPress={() => { hapticLight(); setShowCatSheet(true); }} style={({ pressed }) => [styles.catPill, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Catégorie : ${categoryLabel(category)}`}>
              <Ionicons name="pricetag-outline" size={15} color={colors.primaryDark} />
              <Text style={styles.catPillText}>{categoryLabel(category)}</Text>
              <Ionicons name="chevron-down" size={15} color={colors.primaryDark} />
            </Pressable>

            {/* Zone de texte aérée et sans cadre. */}
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Partage ton expérience, pose une question…"
              placeholderTextColor={colors.textMuted}
              style={styles.textArea}
              multiline
              autoFocus={!needsRules}
              textAlignVertical="top"
              scrollEnabled={false}
            />

            {/* Aperçu des photos ajoutées. */}
            {images.length > 0 ? (
              <View style={styles.thumbGrid}>
                {images.map((url, i) => (
                  <View key={url} style={styles.thumbWrap}>
                    <AppImage source={url} style={styles.thumb} />
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
          </FadeInView>
        </ScrollView>

        {/* Barre d'outils en bas (au-dessus du clavier) : photo + anonyme + aperçu. */}
        <View style={[styles.toolbar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <Pressable
            onPress={() => { hapticLight(); pickImages(); }}
            disabled={uploading || images.length >= MAX_IMAGES}
            style={({ pressed }) => [styles.toolBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Ajouter une photo"
          >
            <Ionicons name="image-outline" size={23} color={uploading || images.length >= MAX_IMAGES ? colors.textMuted : colors.primary} />
            {images.length > 0 ? <Text style={styles.toolCount}>{images.length}/{MAX_IMAGES}</Text> : null}
          </Pressable>

          {!isEdit ? (
            <Pressable
              onPress={() => { hapticLight(); setIsAnonymous((v) => !v); }}
              style={({ pressed }) => [styles.anonChip, isAnonymous && styles.anonChipActive, pressed && styles.pressed]}
              accessibilityRole="switch"
              accessibilityState={{ checked: isAnonymous }}
              accessibilityLabel="Publier anonymement"
            >
              <Ionicons name={isAnonymous ? "eye-off" : "eye-off-outline"} size={16} color={isAnonymous ? colors.white : colors.text} />
              <Text style={[styles.anonChipText, isAnonymous && styles.anonChipTextActive]}>Anonyme</Text>
            </Pressable>
          ) : null}

          <View style={styles.toolbarSpacer} />

          <Pressable onPress={openPreview} hitSlop={8} style={({ pressed }) => [styles.previewLink, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Aperçu">
            <Ionicons name="eye-outline" size={16} color={colors.textMuted} />
            <Text style={styles.previewLinkText}>Aperçu</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Sélecteur de catégorie (sheet glissant). */}
      <ActionSheet visible={showCatSheet} title="Choisir une catégorie" options={catOptions} onClose={() => setShowCatSheet(false)} />

      {/* Aperçu avant publication (option secondaire) : rendu tel qu'il apparaîtra. */}
      <Modal visible={showPreview} transparent animationType="slide" onRequestClose={() => setShowPreview(false)}>
        <View style={styles.previewBackdrop}>
          <View style={styles.previewSheet}>
            <View style={styles.previewBar}>
              <Text style={styles.previewBarTitle}>Aperçu</Text>
              <Pressable onPress={() => setShowPreview(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer l'aperçu">
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.previewScroll}>
              <Card style={styles.previewCard}>
                <View style={styles.previewHead}>
                  <View style={styles.previewAvatar}>
                    <Ionicons name={isAnonymous ? "person-outline" : "person"} size={18} color={colors.primary} />
                  </View>
                  <View style={styles.previewHeadInfo}>
                    <View style={styles.previewAuthorRow}>
                      <Text style={styles.previewAuthor}>{authorDisplayName(isAnonymous, { full_name: profile?.full_name ?? null })}</Text>
                      {!isAnonymous && isVerifiedDoctor ? <VerifiedDoctorBadge specialty={myDoctorSpecialty} /> : null}
                    </View>
                    <Text style={styles.previewTime}>à l'instant</Text>
                  </View>
                  <CategoryTag category={category} />
                </View>

                <Text style={styles.previewBody}>{content.trim()}</Text>

                <PostImages imageUrls={images} imageUrl={null} />
              </Card>
            </ScrollView>

            <View style={styles.previewActions}>
              <View style={styles.previewActionItem}>
                <Button title="Modifier" variant="outline" onPress={() => setShowPreview(false)} />
              </View>
              <View style={styles.previewActionItem}>
                <Button title={isEdit ? "Enregistrer" : "Publier"} onPress={confirmFromPreview} loading={saving} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  // Barre du haut
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  iconBtn: { padding: spacing.xs, marginLeft: -spacing.xs },
  pressed: { opacity: 0.6 },
  publishBtn: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, minWidth: 88, alignItems: "center" },
  publishBtnDisabled: { backgroundColor: colors.border },
  publishBtnPressed: { opacity: 0.85 },
  publishText: { ...typography.caption, color: colors.white, fontWeight: "700" },
  publishTextDisabled: { color: colors.textMuted },

  // Corps
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.md, flexGrow: 1 },
  draftRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.xs },
  draftText: { ...typography.caption, color: colors.primary, fontWeight: "600" },
  rulesCard: { gap: spacing.md, marginBottom: spacing.sm },
  rulesTitle: { ...typography.h3 },
  rulesIntro: { ...typography.caption, color: colors.textMuted, marginTop: -spacing.xs },

  // Pastille catégorie
  catPill: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start",
    backgroundColor: colors.primaryLight, borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  catPillText: { ...typography.caption, color: colors.primaryDark, fontWeight: "700" },

  // Zone de texte sans cadre
  textArea: {
    ...typography.body, color: colors.text, lineHeight: 24, minHeight: 160,
    paddingVertical: spacing.xs, fontFamily: fonts.body,
  },

  // Vignettes photos
  thumbGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  thumbWrap: { width: "31%", aspectRatio: 1, position: "relative" },
  thumb: { width: "100%", height: "100%", borderRadius: radius.md, backgroundColor: colors.surface },
  thumbRemove: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  uploadRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  uploadText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },

  // Barre d'outils basse
  toolbar: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card,
  },
  toolBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, padding: spacing.xs },
  toolCount: { ...typography.caption, color: colors.textMuted, fontWeight: "700" },
  anonChip: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill,
    borderWidth: 1.5, borderColor: colors.border,
  },
  anonChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  anonChipText: { ...typography.caption, color: colors.text, fontWeight: "700" },
  anonChipTextActive: { color: colors.white },
  toolbarSpacer: { flex: 1 },
  previewLink: { flexDirection: "row", alignItems: "center", gap: spacing.xs, padding: spacing.xs },
  previewLinkText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },

  // Aperçu (modal)
  previewBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  previewSheet: {
    backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, maxHeight: "88%",
  },
  previewBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  previewBarTitle: { ...typography.h3 },
  previewScroll: { paddingBottom: spacing.md },
  previewCard: { gap: spacing.sm },
  previewHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  previewAvatar: {
    width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  previewHeadInfo: { flex: 1 },
  previewAuthorRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  previewAuthor: { ...typography.name },
  previewTime: { ...typography.caption, color: colors.textMuted },
  previewBody: { ...typography.body, color: colors.text, lineHeight: 21 },
  previewActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  previewActionItem: { flex: 1 },
});
