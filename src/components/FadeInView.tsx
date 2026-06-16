import { useEffect, useRef, type ReactNode } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import { durations } from "@/theme";

/**
 * Apparition douce du contenu au montage : fade (opacity 0→1) + léger slide
 * (translateY 8→0). Sobre & perf (native driver).
 * - `delay` : décalage d'entrée → permet un effet ÉCHELONNÉ (stagger) en
 *   appliquant des délais croissants à des blocs successifs.
 * - `fill` : par défaut le conteneur prend `flex: 1` (usage écran entier).
 *   Passer `fill={false}` pour envelopper un bloc/carte (taille = contenu).
 */
export function FadeInView({
  children,
  style,
  duration = durations.normal,
  delay = 0,
  fill = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
  delay?: number;
  fill?: boolean;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration, delay, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, duration, delay]);

  return (
    <Animated.View style={[fill ? { flex: 1 } : null, { opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}
