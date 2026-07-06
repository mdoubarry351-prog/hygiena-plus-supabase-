import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";

const BUCKET = "product-images";
const AVATAR_BUCKET = "avatars";
const ARTICLE_BUCKET = "article-images";
const COMMUNITY_BUCKET = "community-images";
const KYC_BUCKET = "doctor-kyc";

// Limites d'upload (P2). Miroir CLIENT des limites SERVEUR posées sur
// storage.buckets (migration 20260705000009 : file_size_limit +
// allowed_mime_types) — le serveur reste la contrainte de référence.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // 5 Mo (images publiques)
export const MAX_KYC_BYTES = 10 * 1024 * 1024;    // 10 Mo (document KYC)

// Décode le base64 en vérifiant la taille ET la signature de fichier : on
// n'envoie que du JPEG (magic bytes FF D8 FF — les pickers de l'app produisent
// du JPEG et l'upload déclare contentType image/jpeg).
function decodeCheckedJpeg(base64: string, maxBytes: number): ArrayBuffer {
  const buf = decode(base64);
  if (buf.byteLength > maxBytes) {
    const mo = Math.round(maxBytes / (1024 * 1024));
    throw new Error(`Image trop lourde : maximum ${mo} Mo.`);
  }
  const b = new Uint8Array(buf);
  if (b.length < 3 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) {
    throw new Error("Format non pris en charge : choisis une photo (JPEG).");
  }
  return buf;
}

/**
 * Uploade une image de produit dans le bucket public `product-images` et
 * renvoie son URL publique (à stocker dans marketplace_products.image_url).
 *
 * On reçoit le base64 fourni par expo-image-picker (option base64:true). En
 * React Native, c'est la méthode FIABLE pour envoyer des octets à supabase-js :
 * on décode le base64 en ArrayBuffer (base64-arraybuffer) avant l'upload.
 * Le picker renvoie des données JPEG (qualité 1 = quasi sans perte, résolution
 * d'origine conservée car allowsEditing:false).
 */
export async function uploadProductImage(base64: string): Promise<string> {
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decodeCheckedJpeg(base64, MAX_IMAGE_BYTES), { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Uploade un avatar (base64 JPEG fourni par expo-image-picker) dans le bucket
 * public `avatars` et renvoie son URL publique (ex. photo d'un médecin).
 */
export async function uploadAvatar(base64: string): Promise<string> {
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, decodeCheckedJpeg(base64, MAX_IMAGE_BYTES), { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Uploade une image de couverture d'article (base64 JPEG fourni par
 * expo-image-picker) dans le bucket public `article-images` et renvoie son URL
 * publique (à stocker dans articles.cover_image_url).
 */
export async function uploadArticleImage(base64: string): Promise<string> {
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabase.storage
    .from(ARTICLE_BUCKET)
    .upload(path, decodeCheckedJpeg(base64, MAX_IMAGE_BYTES), { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  return supabase.storage.from(ARTICLE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Uploade une image jointe à une publication communautaire (base64 JPEG) dans
 * le bucket public `community-images` et renvoie son URL publique.
 *
 * RLS : l'upload est réservé au dossier de l'utilisatrice → on range le fichier
 * sous `${userId}/...`. On récupère l'userId via supabase.auth.getUser().
 */
export async function uploadCommunityImage(base64: string): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Vous devez être connectée pour ajouter une photo.");
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabase.storage
    .from(COMMUNITY_BUCKET)
    .upload(path, decodeCheckedJpeg(base64, MAX_IMAGE_BYTES), { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  return supabase.storage.from(COMMUNITY_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Uploade un document de vérification (KYC) du médecin dans le bucket PRIVÉ
 * `doctor-kyc`, sous son propre dossier `${userId}/license-${timestamp}.jpg`.
 *
 * Bucket privé → on renvoie le CHEMIN du fichier (à stocker dans
 * doctors.license_document_url), pas une URL publique. L'affichage se fait via
 * une URL signée (createSignedUrl) côté admin/médecin.
 */
export async function uploadKycDocument(base64: string): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Vous devez être connecté pour téléverser un document.");
  const path = `${userId}/license-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(KYC_BUCKET)
    .upload(path, decodeCheckedJpeg(base64, MAX_KYC_BYTES), { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  return path;
}
