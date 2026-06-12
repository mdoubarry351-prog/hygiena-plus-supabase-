import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { colors, radius, spacing, typography } from "@/theme";

type Section = { title: string; body: string };

const SECTIONS: Section[] = [
  {
    title: "Données que nous collectons",
    body: "Pour fonctionner, Hygiena+ enregistre : tes données de suivi de cycle (dates de règles, symptômes, flux, humeur, notes), ton profil (nom, téléphone, email, photo éventuelle), tes commandes de la boutique, tes rendez-vous, ainsi que tes messages avec les médecins et tes publications dans la communauté. Tu fournis ces informations volontairement en utilisant l'application.",
  },
  {
    title: "Comment nous utilisons tes données",
    body: "Tes données servent uniquement à te rendre le service : calculer tes prédictions de cycle, gérer tes commandes et rendez-vous, permettre la messagerie de conseils et la communauté. Nous n'utilisons pas tes données de santé à des fins publicitaires et nous ne les vendons pas à des tiers.",
  },
  {
    title: "Protection et stockage",
    body: "Tes données sont hébergées de façon sécurisée et leur accès est restreint par des règles d'autorisation : chaque utilisatrice n'accède qu'à ses propres données (sauf échanges explicites, comme un message envoyé à un médecin). Le code de verrouillage de l'application reste stocké uniquement sur ton appareil.",
  },
  {
    title: "Anonymat dans la communauté",
    body: "Dans la communauté, tu choisis pour chaque publication ou commentaire d'apparaître sous ton nom ou en « Anonyme ». Lorsqu'un contenu est anonyme, ton identité n'est pas révélée aux autres utilisatrices. Tu peux bloquer une personne pour ne plus voir ses contenus.",
  },
  {
    title: "Conservation",
    body: "Tes données sont conservées tant que ton compte est actif. Tu peux les mettre à jour à tout moment depuis ton profil. À la suppression de ton compte, tes données associées sont supprimées (sous réserve des obligations légales éventuelles de conservation).",
  },
  {
    title: "Tes droits",
    body: "Tu disposes d'un droit d'accès, de rectification et de suppression de tes données. Tu peux modifier tes informations dans « Modifier mes informations » et demander la suppression de ton compte. Pour toute demande relative à tes données, contacte le support depuis l'écran Aide & FAQ.",
  },
];

export default function Privacy() {
  return (
    <Screen>
      <ScreenHeader title="Politique de confidentialité" />
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
