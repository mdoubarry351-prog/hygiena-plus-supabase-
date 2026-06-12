import { ActivityIndicator, Pressable, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { colors, radius, spacing, typography } from "@/theme";

// True quand le scroll approche du bas (pour déclencher le chargement de page).
export function isNearBottom(e: NativeSyntheticEvent<NativeScrollEvent>, threshold = 240): boolean {
  const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
  return layoutMeasurement.height + contentOffset.y >= contentSize.height - threshold;
}

// Pied de liste paginée : spinner pendant le fetch, sinon bouton « Charger plus ».
export function LoadMoreFooter({
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  if (!hasMore) return null;
  return (
    <View style={styles.footer}>
      {loadingMore ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Pressable onPress={onLoadMore} style={styles.loadMore} accessibilityRole="button" accessibilityLabel="Charger plus">
          <Text style={styles.loadMoreText}>Charger plus</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: "center", paddingVertical: spacing.md },
  loadMore: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.primary },
  loadMoreText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
});
