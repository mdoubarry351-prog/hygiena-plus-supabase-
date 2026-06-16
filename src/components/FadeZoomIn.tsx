import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";
import { durations } from "@/theme";

/**
 * Entrée « faux-hero » : fondu (opacity 0→1) + léger zoom (scale 1.04→1.0) au
 * montage, easing sortant doux. Donne une continuité visuelle à l'ouverture
 * d'une fiche SANS shared element ni changement de navigation.
 * Animated RN (opacity + scale, useNativeDriver) → compatible Expo Go.
 * Joué une seule fois (deps stables).
 */
export function FadeZoomIn({
  children,
  style,
  duration = durations.slow,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [t, duration]);

  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1] });

  return <Animated.View style={[style, { opacity: t, transform: [{ scale }] }]}>{children}</Animated.View>;
}
