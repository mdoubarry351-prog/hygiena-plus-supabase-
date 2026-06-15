import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { colors, radius, spacing, typography } from "@/theme";

// Coordonnées de support (PLACEHOLDER — à remplacer par les vrais contacts).
const SUPPORT_EMAIL = "support@hygiena.plus";
const SUPPORT_WHATSAPP = "224620000000"; // format international, sans +

const FAQ: { q: string; a: string }[] = [
  {
    q: "Comment fonctionne le suivi de cycle ?",
    a: "Enregistre la date de tes règles (et tes symptômes, flux, humeur) depuis l'accueil. L'application calcule la durée moyenne de ton cycle, estime tes prochaines règles, ta fenêtre fertile et ton ovulation, puis affiche un anneau, un calendrier et un résumé. Plus tu enregistres de cycles, plus les prédictions sont fiables.",
  },
  {
    q: "À quoi sert le mode Premium ?",
    a: "Le Premium débloque la messagerie de conseils avec les médecins vérifiées : tu peux poser tes questions en ligne. Tu peux aussi partager ton suivi de cycle directement dans la conversation pour donner du contexte au médecin.",
  },
  {
    q: "Comment prendre ou annuler un rendez-vous ?",
    a: "Depuis « Consultations », choisis une médecin, une date et un créneau réellement disponibles, puis confirme. Les consultations se déroulent physiquement à la clinique. Dans « Mes rendez-vous », tu peux annuler ou reporter un RDV à venir tant qu'il n'est pas passé.",
  },
  {
    q: "Comment se passe le paiement ?",
    a: "Pour la boutique, tu peux payer par Mobile Money (Orange Money, MTN) ou à la livraison si l'option est proposée. Les paiements Mobile Money sont, dans cette version, simulés (aucune transaction réelle). Les consultations se règlent selon les modalités de la clinique.",
  },
  {
    q: "La communauté est-elle anonyme ?",
    a: "Tu choisis, à chaque publication ou commentaire, de rester anonyme (affiché « Anonyme ») ou non. Tu peux aussi bloquer une personne pour ne plus voir ses contenus, et enregistrer des publications pour les retrouver plus tard.",
  },
  {
    q: "Comment verrouiller l'application ?",
    a: "Dans Profil → « Verrouillage & confidentialité », active un code PIN et, si ton appareil le permet, la biométrie (Face ID / empreinte). L'application se verrouille au démarrage et au retour d'arrière-plan. Ton code reste sur ton téléphone.",
  },
  {
    q: "Mes données sont-elles protégées ?",
    a: "Tes données de cycle, ton profil et tes messages servent uniquement à faire fonctionner l'application. Elles ne sont pas vendues. Consulte la Politique de confidentialité pour le détail et tes droits (accès, suppression de compte).",
  },
];

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <View style={styles.faqItem}>
      <Pressable
        onPress={onToggle}
        style={styles.faqQuestion}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={q}
        accessibilityHint={open ? "Réduire la réponse" : "Afficher la réponse"}
      >
        <Text style={styles.faqQ}>{q}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
      </Pressable>
      {open ? <Text style={styles.faqA}>{a}</Text> : null}
    </View>
  );
}

export default function Help() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  function emailSupport() {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Support Hygiena+")}`).catch(() =>
      Alert.alert("Email indisponible", `Écris-nous à ${SUPPORT_EMAIL}.`)
    );
  }
  function whatsappSupport() {
    Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}`).catch(() =>
      Alert.alert("WhatsApp indisponible", "Impossible d'ouvrir WhatsApp sur cet appareil.")
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Aide & FAQ" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Questions fréquentes sur Hygiena+.</Text>

        <Card style={styles.faqCard}>
          {FAQ.map((item, i) => (
            <FaqItem
              key={i}
              q={item.q}
              a={item.a}
              open={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </Card>

        <Text style={[typography.h3, styles.sectionTitle]}>Nous contacter</Text>
        <Card style={styles.contactCard}>
          <Pressable onPress={emailSupport} style={styles.contactRow} accessibilityRole="button" accessibilityLabel="Contacter le support par email">
            <View style={styles.contactIcon}><Ionicons name="mail-outline" size={20} color={colors.primary} /></View>
            <View style={styles.contactText}>
              <Text style={styles.contactTitle}>Email</Text>
              <Text style={styles.contactSub}>{SUPPORT_EMAIL}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={whatsappSupport} style={styles.contactRow} accessibilityRole="button" accessibilityLabel="Contacter le support sur WhatsApp">
            <View style={styles.contactIcon}><Ionicons name="logo-whatsapp" size={20} color={colors.primary} /></View>
            <View style={styles.contactText}>
              <Text style={styles.contactTitle}>WhatsApp</Text>
              <Text style={styles.contactSub}>Assistance par message</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Card>
        <Text style={styles.note}>Coordonnées de support provisoires — à remplacer par les contacts officiels.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  subtitle: { ...typography.caption, color: colors.textMuted },
  faqCard: { gap: 0 },
  faqItem: { borderTopWidth: 1, borderTopColor: colors.border },
  faqQuestion: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingVertical: spacing.sm },
  faqQ: { ...typography.name, flex: 1 },
  faqA: { ...typography.body, color: colors.textMuted, lineHeight: 21, paddingBottom: spacing.sm },
  sectionTitle: { marginTop: spacing.md },
  contactCard: { gap: spacing.xs },
  contactRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  contactIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  contactText: { flex: 1, gap: 2 },
  contactTitle: { ...typography.name },
  contactSub: { ...typography.caption, color: colors.textMuted },
  note: { ...typography.caption, color: colors.textMuted, fontStyle: "italic" },
});
