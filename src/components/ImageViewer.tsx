import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppImage } from "@/components/AppImage";
import { useToast } from "@/providers/ToastProvider";
import { downloadImageToGallery } from "@/lib/image-download";
import { colors, radius, spacing } from "@/theme";

/**
 * Visionneur plein écran : affiche la photo ENTIÈRE (contentFit="contain") sur
 * fond sombre, avec zoom (pinch via ScrollView), bouton fermer et bouton
 * « Enregistrer dans la galerie ». Ouvert quand `uri` est non-null.
 */
export function ImageViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  if (!uri) return null;

  async function handleDownload() {
    if (saving) return;
    setSaving(true);
    const res = await downloadImageToGallery(uri!);
    setSaving(false);
    if (res === "saved") toast.success("Photo enregistrée dans ta galerie.");
    else if (res === "shared") toast.success("Photo prête — choisis « Enregistrer l'image ».");
    else if (res === "denied") toast.error("Autorise l'accès à la galerie pour enregistrer la photo.");
    else toast.error("Téléchargement impossible. Réessaie.");
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <ScrollView
          style={styles.zoom}
          contentContainerStyle={styles.zoomContent}
          maximumZoomScale={3}
          minimumZoomScale={1}
          centerContent
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          <AppImage source={uri} style={{ width, height }} contentFit="contain" accessibilityLabel="Photo en plein écran" />
        </ScrollView>

        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Fermer">
            <Ionicons name="close" size={26} color={colors.white} />
          </Pressable>
          <Pressable
            onPress={handleDownload}
            hitSlop={12}
            style={styles.iconBtn}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Enregistrer la photo dans la galerie"
          >
            {saving ? <ActivityIndicator color={colors.white} /> : <Ionicons name="download-outline" size={24} color={colors.white} />}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.96)" },
  zoom: { flex: 1 },
  zoomContent: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center",
  },
});
