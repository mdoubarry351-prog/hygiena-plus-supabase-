import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

export type DownloadResult = "saved" | "shared" | "denied" | "error";

// Nom de fichier sûr dérivé de l'URL (sans query string).
function fileNameFromUrl(url: string): string {
  const base = url.split("?")[0].split("/").pop() || "image";
  return /\.(jpg|jpeg|png|webp|gif|heic)$/i.test(base) ? base : `${base}.jpg`;
}

/**
 * Télécharge une image distante dans la galerie de l'appareil.
 * - Demande la permission d'AJOUT (write-only) au moment du téléchargement.
 * - Repli sur le partage (expo-sharing) si media-library indisponible/refusé,
 *   l'utilisateur peut alors « Enregistrer l'image » depuis la feuille de partage.
 * - Tout sous try/catch : renvoie un statut, ne lève jamais.
 */
export async function downloadImageToGallery(url: string): Promise<DownloadResult> {
  try {
    // Télécharge dans le cache (destination unique pour éviter les collisions).
    const dest = new File(Paths.cache, `hygiena_${Date.now()}_${fileNameFromUrl(url)}`);
    const file = await File.downloadFileAsync(url, dest);
    const localUri = file.uri;

    // Enregistrement dans la galerie (permission write-only demandée maintenant).
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (perm.granted) {
        await MediaLibrary.saveToLibraryAsync(localUri);
        return "saved";
      }
    } catch {
      // media-library indisponible (Expo Go iOS, etc.) → on tente le partage.
    }

    // Repli : feuille de partage (« Enregistrer l'image »).
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri);
        return "shared";
      }
    } catch {
      return "error";
    }

    return "denied";
  } catch {
    return "error";
  }
}
