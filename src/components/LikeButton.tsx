import { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/theme";

// Bouton « J'aime » avec retour visuel immédiat : petit « pop » (scale spring)
// à chaque appui. Le cœur et le compteur sont pilotés par le parent (mise à
// jour optimiste), donc aucun rechargement. `count` optionnel (masqué si absent).
export function LikeButton({
  liked,
  count,
  onPress,
  size = 20,
}: {
  liked: boolean;
  count?: number;
  onPress: () => void;
  size?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePress() {
    scale.stopAnimation();
    scale.setValue(1);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.35, useNativeDriver: true, speed: 50, bounciness: 12 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 8 }),
    ]).start();
    onPress();
  }

  return (
    <Pressable onPress={handlePress} hitSlop={8} style={styles.btn} accessibilityRole="button" accessibilityLabel={liked ? "Je n'aime plus" : "J'aime"}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={liked ? "heart" : "heart-outline"} size={size} color={liked ? colors.primary : colors.textMuted} />
      </Animated.View>
      {typeof count === "number" ? (
        <Text style={[styles.count, liked && styles.countActive]}>{count}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  count: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  countActive: { color: colors.primary },
});
