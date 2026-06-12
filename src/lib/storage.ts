import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";

const BUCKET = "product-images";
const AVATAR_BUCKET = "avatars";
const ARTICLE_BUCKET = "article-images";

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
    .upload(path, decode(base64), { contentType: "image/jpeg", upsert: true });
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
    .upload(path, decode(base64), { contentType: "image/jpeg", upsert: true });
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
    .upload(path, decode(base64), { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  return supabase.storage.from(ARTICLE_BUCKET).getPublicUrl(path).data.publicUrl;
}
