import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { colors, spacing, typography } from "@/theme";

type Rule = { icon: keyof typeof Ionicons.glyphMap; title: string; text: string };

// Charte de la communauté — contenu réutilisé par l'écran dédié et l'encart
// d'acceptation à la 1ʳᵉ publication.
const RULES: Rule[] = [
  {
    icon: "heart-outline",
    title: "Respect & bienveillance",
    text: "Soyez courtoise et bienveillante. Chaque personne partage son vécu : accueillez les questions et les expériences sans jugement.",
  },
  {
    icon: "eye-off-outline",
    title: "Confidentialité & anonymat",
    text: "Vous pouvez publier anonymement (votre nom est alors masqué). Ne partagez pas d'informations personnelles permettant d'identifier quelqu'un.",
  },
  {
    icon: "medkit-outline",
    title: "Pas de contenu médical prescriptif",
    text: "Les échanges sont du partage d'expérience entre membres, pas un avis médical. Ne donnez pas de prescription ni de conseil dangereux.",
  },
  {
    icon: "shield-checkmark-outline",
    title: "Ni harcèlement, ni spam, ni haine",
    text: "Aucun harcèlement, propos haineux, discrimination, publicité ou spam. Les contenus illégaux ou choquants sont interdits.",
  },
  {
    icon: "flag-outline",
    title: "Signaler ou bloquer",
    text: "Un contenu vous semble inapproprié ? Signalez-le à la modération via le menu (⋯), ou bloquez la personne pour ne plus voir ses publications.",
  },
];

export function CommunityRules() {
  return (
    <View style={styles.container}>
      {RULES.map((r) => (
        <View key={r.title} style={styles.rule}>
          <View style={styles.icon}>
            <Ionicons name={r.icon} size={18} color={colors.primaryDark} />
          </View>
          <View style={styles.ruleText}>
            <Text style={styles.ruleTitle}>{r.title}</Text>
            <Text style={styles.ruleBody}>{r.text}</Text>
          </View>
        </View>
      ))}
      <MedicalDisclaimer text="Les échanges de la communauté ne remplacent pas une consultation médicale." />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  rule: { flexDirection: "row", gap: spacing.sm },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  ruleText: { flex: 1, gap: 2 },
  ruleTitle: { ...typography.name },
  ruleBody: { ...typography.caption, color: colors.textMuted, lineHeight: 19 },
});
