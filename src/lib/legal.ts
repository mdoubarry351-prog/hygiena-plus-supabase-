// =====================================================
// Hygiena+ — Contenu juridique (source unique).
//
// ⚠️ PROJET — À VALIDER JURIDIQUEMENT. Rédigé de façon spécifique au service
// (données de santé sensibles, hébergement, sous-traitants, Guinée), mais il
// DOIT être relu et validé par un professionnel du droit avant publication.
//
// La VERSION ci-dessous est enregistrée avec le consentement de l'utilisatrice
// (date + version). Toute modification substantielle des textes DOIT
// incrémenter LEGAL_VERSION pour redemander le consentement.
// =====================================================

export const LEGAL_VERSION = "1.0.0";
export const LEGAL_EFFECTIVE_DATE = "2026-07-05";
export const LEGAL_CONTACT_EMAIL = "confidentialite@hygiena.plus"; // TODO : adresse réelle de contact DPO/support

export type LegalSection = { title: string; body: string };
export type LegalDoc = {
  key: "privacy" | "terms";
  title: string;
  sections: LegalSection[];
};

export const PRIVACY: LegalDoc = {
  key: "privacy",
  title: "Politique de confidentialité",
  sections: [
    {
      title: "1. Responsable et objet",
      body: "Hygiena+ est une application de santé féminine destinée aux utilisatrices résidant en Guinée. La présente politique explique quelles données personnelles nous traitons, pourquoi, où elles sont hébergées et quels sont tes droits. En créant un compte, tu reconnais avoir lu cette politique.",
    },
    {
      title: "2. Données de santé — catégorie sensible",
      body: "Hygiena+ traite des DONNÉES DE SANTÉ (dates de règles, symptômes, flux, humeur, notes de cycle, échanges avec des médecins, rendez-vous). Ce sont des données personnelles SENSIBLES. Nous ne les traitons que sur la base de ton consentement explicite, uniquement pour te fournir le service, et jamais à des fins publicitaires. Nous ne vendons aucune donnée.",
    },
    {
      title: "3. Autres données collectées",
      body: "Nous traitons aussi : ton profil (nom, prénom, e-mail, téléphone, photo éventuelle), tes commandes de la boutique et informations de livraison, tes publications et signalements dans la communauté, et des données techniques minimales (jeton de notification push, journaux d'erreurs). Le code de verrouillage de l'app reste stocké uniquement sur ton appareil.",
    },
    {
      title: "4. Hébergement et localisation",
      body: "Tes données sont hébergées par notre sous-traitant Supabase, dans la région AWS us-east-2 (États-Unis, Ohio). Elles sont donc transférées et stockées hors de Guinée. L'accès est restreint par des règles d'autorisation (RLS) : chaque utilisatrice n'accède qu'à ses propres données, sauf partage explicite (par ex. un message envoyé à un médecin).",
    },
    {
      title: "5. Sous-traitants",
      body: "Nous faisons appel à des prestataires qui traitent des données pour notre compte : Supabase (base de données, authentification, stockage, notifications) ; Daily.co (consultations vidéo, lorsque tu démarres un appel avec un médecin). Les paiements mobiles (Orange Money, MTN Mobile Money) sont traités par les opérateurs concernés selon leurs propres conditions. Chaque prestataire n'accède qu'aux données nécessaires à sa fonction.",
    },
    {
      title: "6. Consultations vidéo",
      body: "Les consultations vidéo utilisent Daily.co. Le flux audio/vidéo transite par ce prestataire pour établir l'appel. Nous n'enregistrons pas les appels. L'accès à une salle d'appel est limité aux participantes du rendez-vous concerné.",
    },
    {
      title: "7. Durée de conservation",
      body: "Tes données sont conservées tant que ton compte est actif. À la suppression de ton compte, tes données associées sont supprimées de la base, sous réserve d'obligations légales de conservation éventuelles (par ex. justificatifs de commande). Certaines sauvegardes techniques peuvent subsister un temps limité avant purge.",
    },
    {
      title: "8. Tes droits — accès, rectification, export, suppression",
      body: "Tu peux consulter et modifier tes informations depuis « Modifier mes informations ». Tu peux EXPORTER tes données depuis les réglages (bouton d'export). Tu peux SUPPRIMER définitivement ton compte et tes données depuis les réglages du compte ; la suppression est irréversible. Pour toute autre demande (opposition, limitation), contacte-nous à " + LEGAL_CONTACT_EMAIL + ".",
    },
    {
      title: "9. Consentement",
      body: "Ton consentement à la présente politique est recueilli à l'inscription (case à cocher) et enregistré avec la date et la version du document. Tu peux retirer ton consentement à tout moment en supprimant ton compte. En cas de mise à jour substantielle, un nouveau consentement te sera demandé.",
    },
    {
      title: "10. Limitation géographique",
      body: "Le service est destiné à un usage en Guinée. Il n'est pas conçu pour être utilisé depuis d'autres pays et n'est pas destiné aux personnes mineures sans accord d'un représentant légal.",
    },
    {
      title: "11. Sécurité et notification",
      body: "Nous mettons en œuvre des mesures techniques et organisationnelles (autorisations par ligne, chiffrement en transit, accès restreint). Aucun système n'est infaillible ; en cas d'incident de sécurité affectant tes données, nous nous efforcerons de t'informer sans délai injustifié.",
    },
    {
      title: "12. Contact",
      body: "Pour toute question relative à tes données personnelles, écris à " + LEGAL_CONTACT_EMAIL + " ou utilise l'écran Aide & FAQ de l'application.",
    },
  ],
};

export const TERMS: LegalDoc = {
  key: "terms",
  title: "Conditions générales d'utilisation",
  sections: [
    {
      title: "1. Objet",
      body: "Les présentes conditions régissent l'utilisation d'Hygiena+, application de santé féminine proposant un suivi de cycle, une mise en relation avec des médecins (messagerie et consultations vidéo), une boutique et un espace communautaire. En utilisant l'application, tu acceptes ces conditions.",
    },
    {
      title: "2. Public et zone géographique",
      body: "Le service est destiné aux utilisatrices résidant en Guinée. Il s'adresse à des personnes majeures ou à des personnes mineures disposant de l'accord d'un représentant légal. Nous pouvons restreindre l'accès en dehors de la Guinée.",
    },
    {
      title: "3. Compte",
      body: "Tu es responsable de l'exactitude des informations de ton compte et de la confidentialité de tes identifiants. Un compte est strictement personnel. Choisis un mot de passe robuste (au moins 8 caractères, idéalement 12). Tu t'engages à ne pas usurper l'identité d'une autre personne.",
    },
    {
      title: "4. Nature du service — pas un avis médical",
      body: "Hygiena+ est un outil de bien-être et d'information. Les prédictions de cycle sont indicatives et NE constituent PAS un avis médical. Les échanges avec des médecins via la messagerie ou la vidéo ne remplacent pas une consultation en présentiel : en cas d'urgence ou pour un diagnostic/traitement, consulte une professionnelle de santé.",
    },
    {
      title: "5. Communauté",
      body: "Tu t'engages à publier des contenus respectueux : pas de propos haineux, illégaux, diffamatoires ou portant atteinte à autrui. Les contenus peuvent être signalés et modérés, et un compte peut être suspendu en cas de manquement. Tu peux publier de façon anonyme et bloquer d'autres utilisatrices.",
    },
    {
      title: "6. Commandes et paiements",
      body: "Les commandes de la boutique sont soumises à disponibilité. Les modes de paiement (Orange Money, MTN Mobile Money, paiement à la livraison) peuvent varier. Un paiement n'est réputé validé qu'après confirmation côté serveur : aucun statut « payé » n'est accordé sur simple déclaration depuis l'application. Certaines fonctions de paiement peuvent être en phase de test.",
    },
    {
      title: "7. Rendez-vous et consultations",
      body: "La prise de rendez-vous dépend des disponibilités des médecins vérifiés. Les consultations peuvent se dérouler par messagerie, en vidéo (via Daily.co) ou à la clinique selon le cas. Tu peux annuler ou reporter un rendez-vous à venir depuis l'application, dans les conditions prévues.",
    },
    {
      title: "8. Données personnelles",
      body: "Le traitement de tes données, notamment tes données de santé sensibles, est décrit dans la Politique de confidentialité, que tu dois lire et accepter. Tu disposes de droits d'accès, de rectification, d'export et de suppression.",
    },
    {
      title: "9. Responsabilité",
      body: "Nous nous efforçons d'assurer un service fiable mais ne garantissons pas l'absence d'interruption ou d'erreur. Notre responsabilité ne saurait être engagée pour l'usage que tu fais des informations fournies, ni pour les actes des praticiens tiers, dans les limites permises par la loi applicable.",
    },
    {
      title: "10. Modification et résiliation",
      body: "Ces conditions peuvent être mises à jour ; les modifications substantielles te seront signalées et pourront requérir un nouveau consentement. Tu peux cesser d'utiliser l'application et supprimer ton compte à tout moment depuis les réglages.",
    },
    {
      title: "11. Droit applicable",
      body: "Les présentes conditions sont régies par le droit applicable en République de Guinée, sous réserve des dispositions impératives protégeant les consommateurs. TODO : préciser la juridiction compétente après validation juridique.",
    },
  ],
};

export function legalDoc(key: LegalDoc["key"]): LegalDoc {
  return key === "privacy" ? PRIVACY : TERMS;
}
