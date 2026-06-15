import { StyleSheet, View } from "react-native";
import { colors } from "@/theme";

// Trait de séparation fin et tokenisé (couleur border, épaisseur 1).
// `spacing` ajoute une marge verticale optionnelle.
export function Divider({ spacing: vMargin = 0 }: { spacing?: number }) {
  return <View style={[styles.line, vMargin ? { marginVertical: vMargin } : null]} />;
}

const styles = StyleSheet.create({
  line: { height: 1, backgroundColor: colors.border, alignSelf: "stretch" },
});
