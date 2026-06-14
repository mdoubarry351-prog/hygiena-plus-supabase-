import { StyleSheet, View } from "react-native";
import { AppImage } from "@/components/AppImage";
import { colors, radius, spacing } from "@/theme";

/**
 * Galerie d'images d'une publication communautaire.
 * - 1 image → pleine largeur ; ≥ 2 → grille 2 colonnes.
 * - Repli sur `imageUrl` (ancien champ unique) si `imageUrls` est vide.
 */
export function PostImages({ imageUrls, imageUrl }: { imageUrls?: string[] | null; imageUrl?: string | null }) {
  const urls = imageUrls && imageUrls.length ? imageUrls : imageUrl ? [imageUrl] : [];
  if (urls.length === 0) return null;
  if (urls.length === 1) {
    return <AppImage source={urls[0]} style={styles.single} />;
  }
  return (
    <View style={styles.grid}>
      {urls.map((u, i) => (
        <AppImage key={`${u}-${i}`} source={u} style={styles.cell} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  single: { width: "100%", height: 200, borderRadius: radius.md, backgroundColor: colors.surface },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  cell: { width: "48.5%", aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.surface },
});
