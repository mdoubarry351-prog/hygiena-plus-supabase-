import { NATIVE_ANIM } from "@/lib/anim";
import { forwardRef, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GUINEA_DIAL, GUINEA_FLAG, clampLocal, formatGuineaLocal } from "@/lib/phone";
import { colors, durations, fonts, radius, shadows, spacing, typography } from "@/theme";

type Props = {
  // Valeur AFFICHÉE (formatée à tirets « XXX-XX-XX-XX »).
  value: string;
  // Renvoie la valeur formatée ET les chiffres locaux normalisés (max 9).
  onChangeText: (formatted: string, digits: string) => void;
  label?: string;
  error?: string;
  placeholder?: string;
  autoFocus?: boolean;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: TextInputProps["onSubmitEditing"];
  blurOnSubmit?: boolean;
};

/**
 * Saisie de téléphone Guinée : pastille fixe 🇬🇳 +224 (non éditable) + champ
 * numérique formaté en direct « XXX-XX-XX-XX » (9 chiffres). Même langage visuel
 * que <Input> (label, bordure focus animée, ligne d'erreur). La valeur stockée
 * par l'appelant doit être normalisée en E.164 via toE164() au moment de l'envoi.
 * forwardRef → navigation clavier entre champs (focus/onSubmitEditing).
 */
export const PhoneInput = forwardRef<TextInput, Props>(function PhoneInput(
  { value, onChangeText, label, error, placeholder = "620-00-00-00", autoFocus, returnKeyType, onSubmitEditing, blurOnSubmit },
  ref
) {
  const [focused, setFocused] = useState(false);
  const focus = useRef(new Animated.Value(0)).current;

  function animateFocus(to: number) {
    Animated.timing(focus, { toValue: to, duration: durations.fast, useNativeDriver: false }).start();
  }

  function handleChange(text: string) {
    const digits = clampLocal(text);
    onChangeText(formatGuineaLocal(digits), digits);
  }

  const borderColor = error
    ? colors.danger
    : focus.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.primary] });
  const backgroundColor = focus.interpolate({ inputRange: [0, 1], outputRange: [colors.surface, colors.white] });

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Animated.View style={[styles.container, { borderColor, backgroundColor }, focused && styles.focusedShadow]}>
        {/* Pastille pays non éditable */}
        <View style={styles.prefix} accessible accessibilityLabel="Indicatif Guinée +224">
          <Text style={styles.flag}>{GUINEA_FLAG}</Text>
          <Text style={styles.dial}>{GUINEA_DIAL}</Text>
        </View>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          inputMode="tel"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxLength={12} // « XXX-XX-XX-XX » = 9 chiffres + 3 tirets
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          onFocus={() => { setFocused(true); animateFocus(1); }}
          onBlur={() => { setFocused(false); animateFocus(0); }}
          style={styles.input}
        />
      </Animated.View>
      {error ? <ErrorRow message={error} /> : null}
    </View>
  );
});

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
  // Pastille pays : séparée du champ par un filet.
  prefix: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingRight: spacing.sm,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    height: 28,
  },
  flag: { fontSize: 18 },
  dial: { fontSize: 15, color: colors.primary, fontFamily: fonts.bodySemiBold, fontWeight: "700" },
  input: {
    flex: 1,
    height: 52,
    paddingVertical: 0,
    fontSize: 15,
    color: colors.text,
    fontFamily: fonts.body,
    letterSpacing: 0.5,
  },
  errorRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  error: { ...typography.caption, color: colors.danger, flex: 1 },
});
