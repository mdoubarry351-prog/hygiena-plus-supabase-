import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppImage } from "@/components/AppImage";
import { ImageViewer } from "@/components/ImageViewer";
import { colors, radius, spacing } from "@/theme";

/**
 * Galerie d'images d'une publication / d'un produit.
 * - 1 image → pleine largeur ; ≥ 2 → grille 2 colonnes.
 * - Repli sur `imageUrl` (ancien champ unique) si `imageUrls` est vide.
 * - Tap sur une image → visionneur plein écran (photo ENTIÈRE + téléchargement).
 */
export function PostImages({ imageUrls, imageUrl }: { imageUrls?: string[] | null; imageUrl?: string | null }) {
  const urls = imageUrls && imageUrls.length ? imageUrls : imageUrl ? [imageUrl] : [];
  const [viewer, setViewer] = useState<string | null>(null);
  if (urls.length === 0) return null;

  return (
    <>
      {urls.length === 1 ? (
        <Pressable onPress={() => setViewer(urls[0])} accessibilityRole="imagebutton" accessibilityLabel="Agrandir la photo">
          <AppImage source={urls[0]} style={styles.single} />
        </Pressable>
      ) : (
        <View style={styles.grid}>
          {urls.map((u, i) => (
            <Pressable
              key={`${u}-${i}`}
              onPress={() => setViewer(u)}
              style={styles.cell}
              accessibilityRole="imagebutton"
              accessibilityLabel="Agrandir la photo"
            >
              <AppImage source={u} style={styles.cellImg} />
            </Pressable>
          ))}
        </View>
      )}
      <ImageViewer uri={viewer} onClose={() => setViewer(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  single: { width: "100%", height: 200, borderRadius: radius.md, backgroundColor: colors.surface },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  cell: { width: "48.5%", aspectRatio: 1, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface },
  cellImg: { width: "100%", height: "100%" },
});
