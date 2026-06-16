import { useEffect, type ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import { durations } from "@/theme";

/**
 * Entrée « faux-hero » : fondu (opacity 0→1) + léger zoom (scale 1.04→1.0) au
 * montage, easing sortant doux. Donne une continuité visuelle à l'ouverture
 * d'une fiche SANS shared element ni changement de navigation. Animation sur le
 * thread UI (reanimated). Joué une seule fois (deps stables).
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
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
  }, [t, duration]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ scale: 1.04 - t.value * 0.04 }],
  }));

  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>;
}
