import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography } from "@/theme";

const STAR_COLOR = colors.accent; // ambre

/**
 * Affichage d'une note (lecture seule) : 5 étoiles avec demi-étoiles + note
 * chiffrée et nombre d'avis optionnel.
 */
export function StarRating({
  value,
  count,
  size = 16,
  showValue = true,
  compact = false,
}: {
  value: number;
  count?: number;
  size?: number;
  showValue?: boolean;
  compact?: boolean;
}) {
  const rounded = Math.round(value * 2) / 2; // arrondi au demi
  return (
    <View style={styles.row}>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((i) => {
          const name = rounded >= i ? "star" : rounded >= i - 0.5 ? "star-half" : "star-outline";
          return <Ionicons key={i} name={name} size={size} color={STAR_COLOR} />;
        })}
      </View>
      {showValue && (count ?? 0) > 0 ? (
        <Text style={[styles.value, compact && styles.valueCompact]}>
          {value.toFixed(1)}{count != null ? ` (${count} avis)` : ""}
        </Text>
      ) : null}
      {showValue && (count ?? 0) === 0 ? (
        <Text style={[styles.muted, compact && styles.valueCompact]}>Pas encore d'avis</Text>
      ) : null}
    </View>
  );
}

/**
 * Sélecteur de note (1 à 5) pour saisir un avis.
 */
export function StarSelector({
  value,
  onChange,
  size = 32,
}: {
  value: number;
  onChange: (n: number) => void;
  size?: number;
}) {
  return (
    <View style={styles.selector}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => onChange(i)} hitSlop={6}>
          <Ionicons name={value >= i ? "star" : "star-outline"} size={size} color={STAR_COLOR} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  stars: { flexDirection: "row", gap: 1 },
  value: { ...typography.caption, color: colors.text, fontWeight: "700" },
  valueCompact: { fontSize: 12 },
  muted: { ...typography.caption, color: colors.textMuted },
  selector: { flexDirection: "row", gap: 8 },
});
