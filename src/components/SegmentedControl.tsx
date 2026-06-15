import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Chip } from "@/components/Chip";
import { spacing } from "@/theme";

export type SegmentItem = { key: string; label: string; icon?: keyof typeof Ionicons.glyphMap };

// Barre horizontale de filtres (chips défilantes), sélection unique.
// IMPORTANT : `flexGrow:0/flexShrink:0` sur la barre + `alignItems:center` sur le
// contenu pour ne jamais s'étirer verticalement (bug déjà rencontré).
export function SegmentedControl({
  items,
  value,
  onChange,
  style,
}: {
  items: SegmentItem[];
  value: string;
  onChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.bar, style]} contentContainerStyle={styles.content}>
      {items.map((it) => (
        <Chip key={it.key} label={it.label} icon={it.icon} active={value === it.key} onPress={() => onChange(it.key)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { flexGrow: 0, flexShrink: 0 },
  content: { gap: spacing.xs, alignItems: "center", paddingVertical: spacing.xs },
});
