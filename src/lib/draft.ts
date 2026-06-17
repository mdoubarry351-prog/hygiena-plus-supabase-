import AsyncStorage from "@react-native-async-storage/async-storage";

// Brouillons LOCAUX (AsyncStorage) — filet de sécurité, AUCUN backend.
// Tout est try/catch → no-op silencieux si le stockage est indisponible.
// Ne change jamais le comportement de sauvegarde réel (le bouton reste la vraie
// validation) ; sert seulement à pré-remplir après un retour/crash.

export const DRAFT_KEYS = {
  cycleLog: "draft_cycle_log",
  communityPost: "draft_community_post",
} as const;

export async function getDraft<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function setDraft<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // best-effort : pas bloquant
  }
}

export async function clearDraft(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // best-effort
  }
}
