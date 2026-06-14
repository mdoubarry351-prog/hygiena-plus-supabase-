import { useEffect, useRef, type ReactNode } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import { durations } from "@/theme";

/**
 * Apparition douce du contenu au montage : fade (opacity 0→1) + léger slide
 * (translateY 8→0). UN seul fade du conteneur (pas par élément) → sobre & perf.
 * Utile pour simuler une transition dans l'espace utilisateur (Tabs).
 */
export function FadeInView({
  children,
  style,
  duration = durations.normal,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, duration]);

  return (
    <Animated.View style={[{ flex: 1, opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}
