import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { colors, radius, spacing, typography } from "@/theme";

type Section = { title: string; body: string };

const SECTIONS: Section[] = [
  {
    title: "1. Objet",
    body: "Les présentes conditions régissent l'utilisation de l'application Hygiena+, qui propose un suivi de cycle menstruel, une mise en relation avec des médecins, une boutique et un espace communautaire. En utilisant l'application, tu acceptes ces conditions.",
  },
  {
    title: "2. Compte",
    body: "Tu es responsable de l'exactitude des informations de ton compte et de la confidentialité de tes identifiants. Un compte est personnel. Tu t'engages à ne pas usurper l'identité d'une autre personne.",
  },
  {
    title: "3. Nature du service",
    body: "Hygiena+ est un outil de bien-être et d'information. Les prédictions de cycle sont indicatives et ne constituent pas un avis médical. Les conseils échangés via la messagerie ne remplacent pas une consultation : pour un diagnostic ou un traitement, consulte une professionnelle de santé.",
  },
  {
    title: "4. Communauté",
    body: "Tu t'engages à publier des contenus respectueux : pas de propos haineux, illégaux, ou portant atteinte à autrui. Les contenus inappropriés peuvent être signalés et modérés. Tu peux publier de façon anonyme et bloquer d'autres utilisatrices.",
  },
  {
    title: "5. Commandes et paiements",
    body: "Les commandes de la boutique sont soumises à disponibilité. Les modes de paiement proposés (Mobile Money, paiement à la livraison) peuvent varier. Dans la version actuelle, certains paiements sont simulés et n'entraînent aucune transaction réelle.",
  },
  {
    title: "6. Rendez-vous",
    body: "La prise de rendez-vous se fait selon les disponibilités des médecins. Les consultations se déroulent à la clinique. Tu peux annuler ou reporter un rendez-vous à venir depuis l'application, dans les conditions prévues.",
  },
  {
    title: "7. Responsabilité",
    body: "Nous nous efforçons d'assurer un service fiable mais ne garantissons pas l'absence d'interruption ou d'erreur. Notre responsabilité ne saurait être engagée pour l'usage que tu fais des informations fournies, dans les limites permises par la loi.",
  },
  {
    title: "8. Modification et résiliation",
    body: "Ces conditions peuvent être mises à jour ; les modifications te seront signalées. Tu peux cesser d'utiliser l'application et demander la suppression de ton compte à tout moment.",
  },
];

export default function Terms() {
  return (
    <Screen>
      <ScreenHeader title="Conditions d'utilisation" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.banner}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.bannerText}>
            Ce texte est un modèle générique fourni à titre indicatif. Il doit être relu et validé par un professionnel du droit avant publication.
          </Text>
        </View>

        {SECTIONS.map((s) => (
          <Card key={s.title} style={styles.card}>
            <Text style={styles.cardTitle}>{s.title}</Text>
            <Text style={styles.cardBody}>{s.body}</Text>
          </Card>
        ))}

        <Text style={styles.footerNote}>Dernière mise à jour : modèle initial. Hygiena+.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  banner: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.md },
  bannerText: { ...typography.caption, color: colors.primaryDark, flex: 1, lineHeight: 18 },
  card: { gap: spacing.xs },
  cardTitle: { ...typography.h3 },
  cardBody: { ...typography.body, color: colors.textMuted, lineHeight: 21 },
  footerNote: { ...typography.caption, color: colors.textMuted, fontStyle: "italic", textAlign: "center", marginTop: spacing.sm },
});
