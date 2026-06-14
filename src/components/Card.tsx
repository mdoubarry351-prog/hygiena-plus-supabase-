import { StyleSheet, View, type ViewProps, type GestureResponderEvent } from "react-native";
import { PressableScale } from "@/components/PressableScale";
import { colors, radius, shadows, spacing } from "@/theme";

type Props = ViewProps & {
  // Si fourni, la carte devient tactile (effet d'appui + ombre renforcée).
  onPress?: (e: GestureResponderEvent) => void;
  haptic?: boolean;
  accessibilityLabel?: string;
};

export function Card({ style, children, onPress, haptic, accessibilityLabel, ...rest }: Props) {
  // Carte statique (comportement historique).
  if (!onPress) {
    return (
      <View style={[styles.card, style]} {...rest}>
        {children}
      </View>
    );
  }

  // Carte pressable : ombre sm au repos, md à l'appui. Les enfants restent
  // enfants directs → la mise en page (flexDirection row, gap…) est conservée.
  return (
    <PressableScale
      onPress={onPress}
      haptic={haptic}
      accessibilityLabel={accessibilityLabel}
      style={[styles.card, style]}
      pressedStyle={styles.cardPressed}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardPressed: { ...shadows.md },
});
