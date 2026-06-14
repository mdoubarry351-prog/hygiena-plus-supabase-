import { useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, type StyleProp, type ViewStyle, type GestureResponderEvent } from "react-native";
import { durations } from "@/theme";
import { hapticLight } from "@/lib/haptics";

// Couleur de ripple Android discrète (vert très clair translucide).
const RIPPLE_COLOR = "rgba(16,185,129,0.12)";

type Props = {
  children: ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  // Style additionnel appliqué pendant l'appui (ex. ombre renforcée).
  pressedStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: boolean;
  scaleTo?: number;
  accessibilityLabel?: string;
  hitSlop?: number;
};

/**
 * Wrapper tactile premium : scale + légère opacité à l'appui (Animated), ripple
 * Android discret, haptique optionnel. À utiliser autour des cartes/icônes
 * cliquables là où on avait un <Pressable> nu. Les enfants restent enfants
 * DIRECTS de l'Animated.View → la mise en page (flex/row) est préservée.
 */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  pressedStyle,
  disabled,
  haptic,
  scaleTo = 0.97,
  accessibilityLabel,
  hitSlop = 6,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);

  function animateTo(toScale: number, toOpacity: number) {
    Animated.parallel([
      Animated.spring(scale, { toValue: toScale, useNativeDriver: true, speed: 40, bounciness: 4 }),
      Animated.timing(opacity, { toValue: toOpacity, duration: durations.fast, useNativeDriver: true }),
    ]).start();
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      android_ripple={{ color: RIPPLE_COLOR, borderless: false }}
      onPressIn={() => {
        if (disabled) return;
        if (haptic) hapticLight();
        if (pressedStyle) setPressed(true);
        animateTo(scaleTo, 0.9);
      }}
      onPressOut={() => {
        if (pressedStyle) setPressed(false);
        animateTo(1, 1);
      }}
    >
      <Animated.View style={[{ transform: [{ scale }], opacity }, style, pressed && pressedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
