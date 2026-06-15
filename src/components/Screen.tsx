import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSegments } from "expo-router";
import { colors, layout, spacing } from "@/theme";

type Props = {
  children: ReactNode;
  padded?: boolean;
  // Gestion clavier : KeyboardAvoidingView + ScrollView (les champs ne sont
  // jamais masqués, défilement sur petits écrans). Opt-in pour ne pas changer
  // le comportement des écrans existants (listes/FlatList notamment).
  keyboardAware?: boolean;
  // Tablette / grand écran : contraint le contenu à `layout.maxContentWidth` centré
  // (activé par défaut). En largeur téléphone (< breakpoint) → AUCUN changement.
  // L'espace admin (sidebar propre) est exclu automatiquement.
  constrained?: boolean;
};

export function Screen({ children, padded = true, keyboardAware = false, constrained = true }: Props) {
  const { width } = useWindowDimensions();
  const segments = useSegments();
  // L'admin a sa propre mise en page desktop (sidebar) → on ne la contraint pas.
  const isAdmin = segments[0] === "(admin)";
  const constrain = constrained && !isAdmin && width >= layout.tabletBreakpoint;
  const constrainStyle: ViewStyle | null = constrain
    ? { maxWidth: layout.maxContentWidth, alignSelf: "center", width: "100%" }
    : null;

  const content = keyboardAware ? (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, padded && styles.padded, constrainStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  ) : (
    <View style={[styles.container, padded && styles.padded, constrainStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xl },
  padded: { paddingHorizontal: spacing.lg },
});
