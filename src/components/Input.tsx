import { NATIVE_ANIM } from "@/lib/anim";
import { forwardRef, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, durations, fonts, radius, shadows, spacing, typography } from "@/theme";

type Props = TextInputProps & {
  label?: string;
  error?: string;
  // Icône à gauche dans le champ (Ionicons).
  icon?: keyof typeof Ionicons.glyphMap;
  // Affiche l'icône œil (afficher/masquer) — implicite si secureTextEntry.
  secureToggle?: boolean;
  // Validation temps réel (après 1ʳᵉ interaction) : renvoie un message ou null.
  validate?: (value: string) => string | null;
};

// forwardRef → le ref pointe sur le TextInput interne (navigation clavier entre champs).
export const Input = forwardRef<TextInput, Props>(function Input({
  label,
  error,
  icon,
  secureToggle,
  validate,
  style,
  secureTextEntry,
  value,
  onChangeText,
  onFocus,
  onBlur,
  ...rest
}, ref) {
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const showEye = !!secureToggle || !!secureTextEntry;
  const [hidden, setHidden] = useState(showEye);
  const focus = useRef(new Animated.Value(0)).current;

  const valStr = value != null ? String(value) : "";
  const validationError = validate && touched ? validate(valStr) : null;
  const shownError = error ?? validationError ?? null;

  function animateFocus(to: number) {
    Animated.timing(focus, { toValue: to, duration: durations.fast, useNativeDriver: false }).start();
  }

  // Bordure : rouge si erreur, sinon transition gris → vert au focus.
  const borderColor = shownError
    ? colors.danger
    : focus.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.primary] });
  const backgroundColor = focus.interpolate({ inputRange: [0, 1], outputRange: [colors.surface, colors.white] });

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Animated.View style={[styles.container, { borderColor, backgroundColor }, focused && styles.focusedShadow]}>
        {icon ? (
          <Ionicons name={icon} size={18} color={focused ? colors.primary : colors.textMuted} />
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={showEye ? hidden : secureTextEntry}
          onFocus={(e) => { setFocused(true); animateFocus(1); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); animateFocus(0); setTouched(true); onBlur?.(e); }}
          style={[styles.input, style]}
          {...rest}
        />
        {showEye ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Afficher le mot de passe" : "Masquer le mot de passe"}
          >
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </Animated.View>
      {shownError ? <ErrorRow message={shownError} /> : null}
    </View>
  );
});

// Message d'erreur : icône d'alerte + texte rouge, apparition douce.
function ErrorRow({ message }: { message: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: durations.fast, useNativeDriver: NATIVE_ANIM }).start();
  }, [opacity]);
  return (
    <Animated.View style={[styles.errorRow, { opacity }]}>
      <Ionicons name="alert-circle" size={13} color={colors.danger} />
      <Text style={styles.error}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { ...typography.caption, marginBottom: spacing.xs, color: colors.text, fontWeight: "600", fontFamily: fonts.bodySemiBold },
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  focusedShadow: { ...shadows.sm },
  input: {
    flex: 1,
    height: 52,
    paddingVertical: 0,
    fontSize: 15,
    color: colors.text,
    fontFamily: fonts.body,
  },
  errorRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  error: { ...typography.caption, color: colors.danger, flex: 1 },
});
