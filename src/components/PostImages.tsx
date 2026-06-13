import { Image, StyleSheet, View } from "react-native";
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
    return <Image source={{ uri: urls[0] }} style={styles.single} resizeMode="cover" />;
  }
  return (
    <View style={styles.grid}>
      {urls.map((u, i) => (
        <Image key={`${u}-${i}`} source={{ uri: u }} style={styles.cell} resizeMode="cover" />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  single: { width: "100%", height: 200, borderRadius: radius.md, backgroundColor: colors.surface },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  cell: { width: "48.5%", aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.surface },
});
