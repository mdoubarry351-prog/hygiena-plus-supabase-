import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";

const BUCKET = "product-images";
const AVATAR_BUCKET = "avatars";
const COMMUNITY_BUCKET = "community-images";
const KYC_BUCKET = "doctor-kyc";

// Limites d'upload (P2). Miroir CLIENT des limites SERVEUR posées sur
// storage.buckets (migration 20260705000009 : file_size_limit +
// allowed_mime_types) — le serveur reste la contrainte de référence.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // 5 Mo (images publiques)
export const MAX_KYC_BYTES = 10 * 1024 * 1024;    // 10 Mo (document KYC)

// Formats acceptés = ceux autorisés par les buckets (allowed_mime_types :
// jpeg/png/webp, migration 20260705000009). On lit la signature réelle (magic
// bytes) et on renvoie le contentType EXACT à déclarer à l'upload, au lieu de
// supposer du JPEG. Les photos iPhone HEIC sont transcodées en JPEG dès la
// sélection (picker en preferredAssetRepresentationMode 'compatible'), donc
// elles arrivent ici en JPEG ; les captures d'écran PNG passent aussi.
function sniffImageMime(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) return "image/png";
  if (
    b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return "image/webp";
  return null;
}

// Extension de fichier correspondant au type MIME détecté.
function extForMime(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

// Décode le base64 en vérifiant la taille ET le format réel. Renvoie les octets
// et le contentType à déclarer à Storage.
function decodeCheckedImage(base64: string, maxBytes: number): { data: ArrayBuffer; contentType: string } {
  const buf = decode(base64);
  if (buf.byteLength > maxBytes) {
    const mo = Math.round(maxBytes / (1024 * 1024));
    throw new Error(`Image trop lourde : maximum ${mo} Mo.`);
  }
  const contentType = sniffImageMime(new Uint8Array(buf));
  if (!contentType) {
    throw new Error("Format non pris en charge : choisis une photo (JPEG, PNG ou WebP).");
  }
  return { data: buf, contentType };
}

// Session courante, exigée pour tout upload. Les buckets ont des policies RLS
// `TO authenticated` : sans jeton, la requête part en rôle `anon` et Storage la
// rejette. Or supabase-js résout le jeton via getSession() AU MOMENT de la
// requête et retombe SILENCIEUSEMENT sur la clé anon si la session n'est pas
// (encore) résolue → upload anonyme → violation RLS. On lit donc la session
// nous-mêmes AVANT l'upload et on échoue explicitement si elle manque.
async function requireUploadSession(action: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error(`Vous devez être connectée pour ${action}.`);
  return session;
}

// En-tête d'auth à joindre EXPLICITEMENT à chaque .upload() : `fetchWithAuth`
// (supabase-js) ne pose l'Authorization que s'il est absent, donc en le
// fournissant on garantit le jeton utilisateur (jamais le fallback anon).
function bearer(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

/**
 * Uploade une image de produit dans le bucket public `product-images` et
 * renvoie son URL publique (à stocker dans marketplace_products.image_url).
 *
 * On reçoit le base64 fourni par expo-image-picker (option base64:true). En
 * React Native, c'est la méthode FIABLE pour envoyer des octets à supabase-js :
 * on décode le base64 en ArrayBuffer (base64-arraybuffer) avant l'upload.
 * Le format (jpeg/png/webp) est détecté et déclaré à Storage.
 */
export async function uploadProductImage(base64: string): Promise<string> {
  const session = await requireUploadSession("ajouter une image");
  const { data, contentType } = decodeCheckedImage(base64, MAX_IMAGE_BYTES);
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extForMime(contentType)}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, data, { contentType, upsert: true, headers: bearer(session.access_token) });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Uploade un avatar (base64 fourni par expo-image-picker) dans le bucket public
 * `avatars` et renvoie son URL publique (ex. photo d'un médecin).
 */
export async function uploadAvatar(base64: string): Promise<string> {
  const session = await requireUploadSession("ajouter une photo");
  const { data, contentType } = decodeCheckedImage(base64, MAX_IMAGE_BYTES);
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extForMime(contentType)}`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, data, { contentType, upsert: true, headers: bearer(session.access_token) });
  if (error) throw error;
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Uploade une image jointe à une publication communautaire (base64) dans le
 * bucket public `community-images` et renvoie son URL publique.
 *
 * RLS : l'upload est réservé au dossier de l'utilisatrice → on range le fichier
 * sous `${userId}/...` (userId = id de la session, égal à auth.uid()).
 */
export async function uploadCommunityImage(base64: string): Promise<string> {
  const session = await requireUploadSession("ajouter une photo");
  const userId = session.user.id;
  const { data, contentType } = decodeCheckedImage(base64, MAX_IMAGE_BYTES);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extForMime(contentType)}`;
  const { error } = await supabase.storage
    .from(COMMUNITY_BUCKET)
    .upload(path, data, { contentType, upsert: true, headers: bearer(session.access_token) });
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
  const session = await requireUploadSession("téléverser un document");
  const userId = session.user.id;
  const { data, contentType } = decodeCheckedImage(base64, MAX_KYC_BYTES);
  const path = `${userId}/license-${Date.now()}.${extForMime(contentType)}`;
  const { error } = await supabase.storage
    .from(KYC_BUCKET)
    .upload(path, data, { contentType, upsert: true, headers: bearer(session.access_token) });
  if (error) throw error;
  return path;
}
