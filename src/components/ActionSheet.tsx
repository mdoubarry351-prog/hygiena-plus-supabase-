import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "@/theme";

export type ActionSheetOption = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
};

/**
 * Menu d'actions qui glisse du bas (sans dépendance externe).
 * Liste d'options + bouton « Annuler ». Thème vert.
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
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" />
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
