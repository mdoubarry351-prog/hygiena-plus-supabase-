import { NATIVE_ANIM } from "@/lib/anim";
import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { durations } from "@/theme";

/**
 * Icône avec micro-« pop » (ressort scale) au CHANGEMENT de `popKey` — même
 * ressenti que l'ancien HeartButton. Animated RN (scale, useNativeDriver) →
 * compatible Expo Go. N'anime PAS au premier rendu (état initial). Réutilisable
 * pour like, bookmark, ajout panier, etc. L'haptique reste gérée par le parent.
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
  const scale = useRef(new Animated.Value(1)).current;
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.3, duration: durations.fast, useNativeDriver: NATIVE_ANIM }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: NATIVE_ANIM, speed: 20, bounciness: 12 }),
    ]).start();
  }, [popKey, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}
