import { useCallback, useState } from "react";
import {
  FlatList, Pressable, StyleSheet, useWindowDimensions, View,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from "react-native";
import { AppImage } from "@/components/AppImage";
import { ImageViewer } from "@/components/ImageViewer";
import { colors, layout, radius, spacing } from "@/theme";

const HEIGHT = 320;

/**
 * Galerie produit défilable horizontalement (paging) avec points de pagination.
 * - 1 image → affichage simple (pas de points).
 * - ≥ 2 → swipe page par page + dots ; le point actif s'allonge (token primary).
 * - Tap sur une image → visionneur plein écran (photo entière + téléchargement).
 * Largeur de page calée sur le contenu (Screen `padded` + contrainte tablette).
 */
export function ProductGallery({ imageUrls, imageUrl }: { imageUrls?: string[] | null; imageUrl?: string | null }) {
  const urls = imageUrls && imageUrls.length ? imageUrls : imageUrl ? [imageUrl] : [];
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  // Largeur d'une page = largeur de contenu (min écran/tablette) moins le padding latéral du Screen.
  const pageW = Math.min(width, layout.maxContentWidth) - spacing.lg * 2;

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.round(e.nativeEvent.contentOffset.x / pageW);
      setIndex(i);
    },
    [pageW]
  );

  const getItemLayout = useCallback(
    (_: unknown, i: number) => ({ length: pageW, offset: pageW * i, index: i }),
    [pageW]
  );

  if (urls.length === 0) return null;

  // Image unique : pas de paging ni de points.
  if (urls.length === 1) {
    return (
      <>
        <Pressable onPress={() => setViewer(urls[0])} accessibilityRole="imagebutton" accessibilityLabel="Agrandir la photo">
          <AppImage source={urls[0]} style={styles.single} contentFit="contain" />
        </Pressable>
        <ImageViewer uri={viewer} onClose={() => setViewer(null)} />
      </>
    );
  }

  return (
    <View>
      <FlatList
        data={urls}
        keyExtractor={(u, i) => `${u}-${i}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        getItemLayout={getItemLayout}
        renderItem={({ item }) => (
          <Pressable onPress={() => setViewer(item)} style={{ width: pageW }} accessibilityRole="imagebutton" accessibilityLabel="Agrandir la photo">
            <AppImage source={item} style={[styles.page, { width: pageW }]} contentFit="contain" />
          </Pressable>
        )}
      />
      {/* Points de pagination */}
      <View style={styles.dots} pointerEvents="none">
        {urls.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
      <ImageViewer uri={viewer} onClose={() => setViewer(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  single: { width: "100%", height: HEIGHT, borderRadius: radius.lg, backgroundColor: colors.surface },
  page: { height: HEIGHT, borderRadius: radius.lg, backgroundColor: colors.surface },
  dots: { flexDirection: "row", alignSelf: "center", gap: spacing.xs, marginTop: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 18, backgroundColor: colors.primary },
});
