import { useEffect, useRef, useState } from "react";
import { Animated, LayoutAnimation, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useToast } from "@/providers/ToastProvider";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { FadeInView } from "@/components/FadeInView";
import { TrustRow } from "@/components/TrustRow";
import { PREMIUM_ENABLED } from "@/lib/app-config";
import { useAppSettings, SERVICE_UNAVAILABLE_MSG } from "@/hooks/useAppSettings";
import { marketplaceService } from "@/lib/marketplace-service";
import { colors, durations, radius, spacing, typography } from "@/theme";

// Active les transitions de layout sur Android (même réglage que cycle/learn).
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Coordonnées de support (repli si aucun numéro WhatsApp n'est configuré côté boutique).
const SUPPORT_EMAIL = "support@hygiena.plus";
const SUPPORT_WHATSAPP_FALLBACK = "224620000000"; // format international, sans +

const STEP = 70;

type Faq = { q: string; a: string };
type FaqCategory = { key: string; title: string; icon: keyof typeof Ionicons.glyphMap; items: Faq[] };

// FAQ par catégories — réponses claires et rassurantes, en tutoiement.
const FAQ_CATEGORIES: FaqCategory[] = [
  {
    key: "cycle", title: "Cycle", icon: "calendar-outline",
    items: [
      { q: "Comment fonctionne le suivi de cycle ?", a: "Enregistre la date de tes règles (et tes symptômes, flux, humeur) depuis l'accueil. L'application calcule la durée moyenne de ton cycle, estime tes prochaines règles, ta fenêtre fertile et ton ovulation, puis affiche un anneau, un calendrier et un résumé. Plus tu enregistres de cycles, plus les prédictions sont fiables." },
      { q: "Mes prédictions sont-elles fiables ?", a: "Ce sont des estimations indicatives, pas un avis médical. Elles s'affinent à mesure que tu enregistres tes cycles. En cas de doute sur ta santé, parles-en à une médecin." },
      { q: "Puis-je modifier un enregistrement ?", a: "Oui. Depuis le calendrier ou l'historique du cycle, tu peux ouvrir une date pour corriger ou supprimer ce que tu as saisi." },
    ],
  },
  {
    key: "community", title: "Communauté", icon: "chatbubbles-outline",
    items: [
      { q: "La communauté est-elle anonyme ?", a: "Tu choisis, à chaque publication ou commentaire, de rester anonyme (affiché « Anonyme ») ou non. Tes échanges restent dans un cadre bienveillant." },
      { q: "Comment signaler ou bloquer quelqu'un ?", a: "Sur une publication ou un profil, utilise le menu pour signaler un contenu inapproprié ou bloquer une personne : tu ne verras plus ses contenus. Tu peux aussi enregistrer des publications pour les retrouver plus tard." },
    ],
  },
  {
    key: "marketplace", title: "Marketplace", icon: "bag-handle-outline",
    items: [
      { q: "Comment se passe le paiement ?", a: "Tu peux payer par Mobile Money (Orange Money, MTN) ou à la livraison si l'option est proposée. Dans cette version, les paiements Mobile Money sont simulés (aucune transaction réelle)." },
      { q: "Comment suivre ma commande ?", a: "Depuis « Mes commandes », tu retrouves chaque commande avec son statut (en attente, en préparation, expédiée, livrée) et son récapitulatif." },
      { q: "La livraison est-elle disponible partout ?", a: "La livraison dépend des zones desservies et des frais affichés au moment de la commande. Le retrait en boutique est aussi possible." },
    ],
  },
  {
    key: "appointments", title: "Rendez-vous", icon: "medkit-outline",
    items: [
      { q: "Comment prendre ou annuler un rendez-vous ?", a: "Depuis « Consultations », choisis une médecin, une date et un créneau réellement disponibles, puis confirme. Dans « Mes rendez-vous », tu peux annuler ou reporter un RDV tant qu'il n'est pas passé." },
      { q: "Où ont lieu les consultations ?", a: "Les consultations se déroulent physiquement à la clinique de la médecin. Les modalités (tarif, lieu) sont indiquées sur sa fiche." },
      { q: "Les médecins sont-elles vérifiées ?", a: "Oui. Chaque médecin est validée par notre équipe avant d'apparaître : tu vois le badge « Médecin vérifié » sur sa fiche." },
    ],
  },
  {
    key: "premium", title: "Premium", icon: "star-outline",
    items: [
      { q: "À quoi sert le mode Premium ?", a: "Le Premium débloque la messagerie de conseils avec les médecins vérifiées : tu peux poser tes questions en ligne et partager ton suivi de cycle pour donner du contexte." },
      { q: "Comment me désabonner ?", a: "Depuis l'écran Premium, tu peux te désabonner à tout moment. L'abonnement est sans engagement (paiement simulé, aucun débit réel dans cette version)." },
    ],
  },
  {
    key: "account", title: "Compte & confidentialité", icon: "lock-closed-outline",
    items: [
      { q: "Mes données sont-elles protégées ?", a: "Tes données de cycle, ton profil et tes messages servent uniquement à faire fonctionner l'application. Elles ne sont pas vendues. Consulte la Politique de confidentialité pour le détail et tes droits." },
      { q: "Comment verrouiller l'application ?", a: "Dans Profil → « Verrouillage & confidentialité », active un code PIN et, si ton appareil le permet, la biométrie. L'application se verrouille au démarrage et au retour d'arrière-plan. Ton code reste sur ton téléphone." },
      { q: "Comment supprimer mon compte ?", a: "Depuis Profil → confidentialité, tu peux demander la suppression de ton compte et de tes données. Au besoin, contacte le support, on t'accompagne." },
    ],
  },
];

type Guide = { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; href: Href; module?: "marketplace" | "doctors" };
const GUIDES: Guide[] = [
  { icon: "water-outline", title: "Suivre mon cycle", sub: "Enregistrer mes règles et symptômes", href: "/(user)/cycle/calendar" },
  { icon: "medkit-outline", title: "Prendre un rendez-vous", sub: "Choisir une médecin et un créneau", href: "/(user)/appointments", module: "doctors" },
  { icon: "bag-handle-outline", title: "Acheter en boutique", sub: "Commander des produits santé", href: "/(user)/marketplace", module: "marketplace" },
  { icon: "chatbubbles-outline", title: "Poster dans la communauté", sub: "Partager, anonyme si tu veux", href: "/(user)/community" },
];

// Chevron qui pivote (Animated, useNativeDriver) — compatible Expo Go.
function Chevron({ open }: { open: boolean }) {
  const r = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(r, { toValue: open ? 1 : 0, duration: durations.fast, useNativeDriver: true }).start();
  }, [open, r]);
  const rotate = r.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
    </Animated.View>
  );
}

function FaqRow({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
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
        <Chevron open={open} />
      </Pressable>
      {open ? <Text style={styles.faqA}>{a}</Text> : null}
    </View>
  );
}

export default function Help() {
  const router = useRouter();
  const toast = useToast();
  const { marketplace_enabled, doctors_enabled } = useAppSettings();
  const [openId, setOpenId] = useState<string | null>("cycle:0");
  const [query, setQuery] = useState("");
  const [whatsapp, setWhatsapp] = useState<string | null>(null);

  // Numéro WhatsApp officiel s'il est configuré côté boutique (sinon repli).
  useEffect(() => {
    let alive = true;
    marketplaceService.getStorePaymentSettings().then((s) => {
      if (alive && s?.whatsapp_enabled && s.whatsapp_number) setWhatsapp(s.whatsapp_number);
    }).catch(() => { /* non bloquant */ });
    return () => { alive = false; };
  }, []);

  // Une seule réponse ouverte à la fois ; la transition de hauteur est animée.
  function toggle(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenId((cur) => (cur === id ? null : id));
  }

  // Catégorie Premium retirée tant que le Premium est désactivé (réversible).
  const baseCategories = PREMIUM_ENABLED ? FAQ_CATEGORIES : FAQ_CATEGORIES.filter((c) => c.key !== "premium");
  const q = query.trim().toLowerCase();
  const categories = q
    ? baseCategories.map((c) => ({ ...c, items: c.items.filter((it) => (it.q + " " + it.a).toLowerCase().includes(q)) })).filter((c) => c.items.length > 0)
    : baseCategories;

  function emailSupport() {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Support Hygiena+")}`).catch(() =>
      toast.error(`Email indisponible. Écris-nous à ${SUPPORT_EMAIL}.`)
    );
  }
  function whatsappSupport() {
    const num = (whatsapp ?? SUPPORT_WHATSAPP_FALLBACK).replace(/[^0-9]/g, "");
    Linking.openURL(`https://wa.me/${num}`).catch(() =>
      toast.error("WhatsApp indisponible. Impossible d'ouvrir WhatsApp sur cet appareil.")
    );
  }

  function openGuide(g: Guide) {
    if (g.module === "marketplace" && !marketplace_enabled) return toast.info(SERVICE_UNAVAILABLE_MSG);
    if (g.module === "doctors" && !doctors_enabled) return toast.info(SERVICE_UNAVAILABLE_MSG);
    router.push(g.href);
  }

  return (
    <Screen>
      <ScreenHeader title="Aide & FAQ" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* 1 · Recherche */}
        <FadeInView fill={false} delay={0}>
          <Text style={styles.subtitle}>Une question ? Cherche ou parcours les rubriques ci-dessous.</Text>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher dans l'aide…"
            autoCapitalize="none"
            style={styles.search}
          />
        </FadeInView>

        {/* 2 · FAQ par catégories (accordéons) */}
        <FadeInView fill={false} delay={STEP}>
          {categories.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="search-outline" size={20} color={colors.textMuted} />
              <Text style={styles.emptyText}>Aucune réponse ne correspond à « {query.trim()} ». Reformule ou contacte le support.</Text>
            </Card>
          ) : (
            categories.map((cat) => (
              <View key={cat.key} style={styles.catBlock}>
                <View style={styles.catTitleRow}>
                  <View style={styles.catIcon}><Ionicons name={cat.icon} size={16} color={colors.primaryDark} /></View>
                  <Text style={styles.catTitle}>{cat.title}</Text>
                </View>
                <Card style={styles.faqCard}>
                  {cat.items.map((item, i) => {
                    const id = `${cat.key}:${i}`;
                    return <FaqRow key={id} q={item.q} a={item.a} open={openId === id} onToggle={() => toggle(id)} />;
                  })}
                </Card>
              </View>
            ))
          )}
        </FadeInView>

        {/* 3 · Guides « Comment ça marche » */}
        <FadeInView fill={false} delay={STEP * 2}>
          <Text style={[typography.h3, styles.sectionTitle]}>Comment ça marche</Text>
          <View style={styles.guideStack}>
            {GUIDES.map((g) => (
              <Card key={g.title} onPress={() => openGuide(g)} haptic accessibilityLabel={g.title} style={styles.guideCard}>
                <View style={styles.guideIcon}><Ionicons name={g.icon} size={20} color={colors.primary} /></View>
                <View style={styles.guideText}>
                  <Text style={styles.guideTitle}>{g.title}</Text>
                  <Text style={styles.guideSub}>{g.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Card>
            ))}
          </View>
        </FadeInView>

        {/* 4 · Contact support */}
        <FadeInView fill={false} delay={STEP * 3}>
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
          <View style={styles.trust}>
            <TrustRow signals={["privacy", "verified", "confidential"]} />
          </View>
        </FadeInView>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  subtitle: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  search: { marginBottom: 0 },

  // FAQ catégories
  catBlock: { marginBottom: spacing.md },
  catTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.xs },
  catIcon: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  catTitle: { ...typography.name, color: colors.text },
  faqCard: { gap: 0 },
  faqItem: { borderTopWidth: 1, borderTopColor: colors.border },
  faqQuestion: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingVertical: spacing.sm },
  faqQ: { ...typography.name, flex: 1 },
  faqA: { ...typography.body, color: colors.textMuted, lineHeight: 21, paddingBottom: spacing.sm },
  emptyCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface },
  emptyText: { ...typography.caption, color: colors.textMuted, flex: 1, lineHeight: 19 },

  // Guides
  sectionTitle: { marginBottom: spacing.sm },
  guideStack: { gap: spacing.sm },
  guideCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  guideIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  guideText: { flex: 1, gap: 2 },
  guideTitle: { ...typography.name },
  guideSub: { ...typography.caption, color: colors.textMuted },

  // Contact
  contactCard: { gap: spacing.xs },
  contactRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  contactIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  contactText: { flex: 1, gap: 2 },
  contactTitle: { ...typography.name },
  contactSub: { ...typography.caption, color: colors.textMuted },
  trust: { marginTop: spacing.md },
});
