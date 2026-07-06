import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/Card";
import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSION, type LegalDoc } from "@/lib/legal";
import { colors, radius, spacing, typography } from "@/theme";

// Rendu partagé d'un document juridique (confidentialité ou CGU), avec le
// bandeau « PROJET — À VALIDER JURIDIQUEMENT » et la version/date affichées.
export function LegalDocument({ doc }: { doc: LegalDoc }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.draftBanner}>
        <Ionicons name="warning-outline" size={18} color={colors.danger} />
        <Text style={styles.draftText}>
          PROJET — À VALIDER JURIDIQUEMENT. Ce texte doit être relu et validé par un professionnel du droit avant publication.
        </Text>
      </View>

      <Text style={styles.meta}>
        Version {LEGAL_VERSION} · en vigueur le {LEGAL_EFFECTIVE_DATE}
      </Text>

      {doc.sections.map((s) => (
        <Card key={s.title} style={styles.card}>
          <Text style={styles.cardTitle}>{s.title}</Text>
          <Text style={styles.cardBody}>{s.body}</Text>
        </Card>
      ))}

      <Text style={styles.footerNote}>Hygiena+ · {doc.title}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  draftBanner: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: "#FDECEC", borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.danger },
  draftText: { ...typography.caption, color: colors.danger, flex: 1, lineHeight: 18, fontWeight: "700" },
  meta: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
  card: { gap: spacing.xs },
  cardTitle: { ...typography.h3 },
  cardBody: { ...typography.body, color: colors.textMuted, lineHeight: 21 },
  footerNote: { ...typography.caption, color: colors.textMuted, fontStyle: "italic", textAlign: "center", marginTop: spacing.sm },
});
