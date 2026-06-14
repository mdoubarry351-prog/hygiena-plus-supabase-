import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, durations } from "@/theme";

/**
 * Cœur animé : « pop » (scale spring) au changement d'état aimé/non aimé.
 * Composant PUREMENT visuel — le toggle optimiste + l'haptique restent gérés
 * par le parent (qui conserve son Pressable et le compteur éventuel).
 */
export function HeartButton({
  active,
  size = 20,
  activeColor = colors.primary,
  inactiveColor = colors.textMuted,
}: {
  active: boolean;
  size?: number;
  activeColor?: string;
  inactiveColor?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const mounted = useRef(false);

  useEffect(() => {
    // Pas d'animation au tout premier rendu (état initial).
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.3, duration: durations.fast, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 12 }),
    ]).start();
  }, [active, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name={active ? "heart" : "heart-outline"} size={size} color={active ? activeColor : inactiveColor} />
    </Animated.View>
  );
}
