// Configuration centralisée de l'application.

// Lien de téléchargement de l'app, partagé via « Inviter un ami » et le partage
// d'une publication. À REMPLACER par le lien store réel une fois publié.
export const APP_DOWNLOAD_URL = "https://hygiena.plus";

// --- Bascules produit (réversibles) ---------------------------------------
// Le Premium et la messagerie médecin sont retirés de l'interface patiente au
// profit du paiement à la consultation + contact post-paiement. Le code, les
// écrans, le service et le backend restent intacts : repasser un flag à `true`
// réaffiche toutes les surfaces correspondantes (aucune suppression).

// Abonnement Premium (écran, carte accueil, statut profil, FAQ, notifs).
export const PREMIUM_ENABLED = false;

// Messagerie / salle de consultation in-app patiente ↔ praticien. L'accès est
// désormais lié à l'existence d'un rendez-vous (RLS), plus au Premium.
export const DOCTOR_MESSAGING_ENABLED = true;

// Carte « Conseils & infos » (bibliothèque d'articles santé) dans la grille
// « Accès rapide » de l'accueil. La bibliothèque et l'admin Articles restent
// intacts : repasser à `true` réaffiche le point d'entrée depuis l'accueil.
export const SHOW_ARTICLES = false;
