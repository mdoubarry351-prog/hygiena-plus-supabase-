import { useEffect, useRef } from "react";
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, withSpring, Easing } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { durations } from "@/theme";

/**
 * Icône avec micro-« pop » (ressort scale) au CHANGEMENT de `popKey` — même
 * ressenti que l'ancien HeartButton, unifié sur reanimated (thread UI).
 * N'anime PAS au premier rendu (état initial). Réutilisable pour like, bookmark,
 * ajout panier, etc. L'haptique reste gérée par le parent.
 */
export function BouncyIcon({
  name,
  size = 20,
  color,
  popKey,
}: {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color: string;
  // Valeur dont le changement déclenche le pop (ex. booléen aimé/enregistré).
  popKey: string | number | boolean;
}) {
  const scale = useSharedValue(1);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    scale.value = withSequence(
      withTiming(1.3, { duration: durations.fast, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 8, stiffness: 180, mass: 0.6 })
    );
  }, [popKey, scale]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animStyle}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}
