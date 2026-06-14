import { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, durations, radius, spacing, typography } from "@/theme";

export type ActionSheetOption = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
};

// Décalage initial pour faire glisser la feuille hors écran (vers le bas).
const SHEET_OFFSET = 360;

/**
 * Menu d'actions qui glisse du bas (Animated, sans dépendance externe).
 * Ouverture : slide-up de la feuille + fondu du backdrop.
 * Fermeture : animation inverse douce avant le démontage du Modal.
 */
export function ActionSheet({
  visible,
  title,
  options,
  onClose,
}: {
  visible: boolean;
  title?: string;
  options: ActionSheetOption[];
  onClose: () => void;
}) {
  // On garde le Modal monté pendant l'animation de sortie.
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(SHEET_OFFSET)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Anime à l'image suivante (après le montage du Modal).
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 4 }),
          Animated.timing(backdrop, { toValue: 1, duration: durations.normal, useNativeDriver: true }),
        ]).start();
      });
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: SHEET_OFFSET, duration: durations.fast, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: durations.fast, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" />
        </Animated.View>
        <Animated.View style={{ transform: [{ translateY }] }}>
          <SafeAreaView edges={["bottom"]} style={styles.bottom}>
            <View style={styles.sheet}>
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {options.map((opt, i) => (
                <Pressable
                  key={`${opt.label}-${i}`}
                  onPress={() => { onClose(); opt.onPress(); }}
                  style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                >
                  {opt.icon ? (
                    <Ionicons name={opt.icon} size={20} color={opt.destructive ? colors.danger : colors.primaryDark} />
                  ) : null}
                  <Text style={[styles.optionText, opt.destructive && styles.destructive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button" accessibilityLabel="Annuler">
              <Text style={styles.cancelText}>Annuler</Text>
            </Pressable>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  bottom: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  sheet: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xs, overflow: "hidden" },
  title: { ...typography.caption, color: colors.textMuted, fontWeight: "700", textAlign: "center", paddingVertical: spacing.sm },
  option: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md },
  optionPressed: { backgroundColor: colors.surface },
  optionText: { ...typography.body, color: colors.text, fontWeight: "600" },
  destructive: { color: colors.danger },
  cancel: { backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: "center" },
  cancelText: { ...typography.body, color: colors.primary, fontWeight: "700" },
});
