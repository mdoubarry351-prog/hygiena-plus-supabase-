import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";

// Tout reste SUR L'APPAREIL (SecureStore = Keychain/Keystore chiffré).
// Rien n'est envoyé à Supabase.
const PIN_KEY = "applock_pin";
const ENABLED_KEY = "applock_enabled";
const BIOMETRIC_KEY = "applock_biometric";

// Web (admin sur navigateur) : SecureStore/biométrie ne sont pas disponibles.
// On court-circuite proprement → verrou désactivé, aucun appel natif, aucun
// crash/console error au boot. Comportement MOBILE strictement inchangé.
const WEB = Platform.OS === "web";

export type LockConfig = { enabled: boolean; biometric: boolean };

export const appLock = {
  async getConfig(): Promise<LockConfig> {
    if (WEB) return { enabled: false, biometric: false };
    const [enabled, biometric] = await Promise.all([
      SecureStore.getItemAsync(ENABLED_KEY),
      SecureStore.getItemAsync(BIOMETRIC_KEY),
    ]);
    return { enabled: enabled === "1", biometric: biometric === "1" };
  },

  async hasPin(): Promise<boolean> {
    if (WEB) return false;
    return !!(await SecureStore.getItemAsync(PIN_KEY));
  },

  // Active le verrouillage avec un nouveau code.
  async enableLock(pin: string): Promise<void> {
    if (WEB) return;
    await SecureStore.setItemAsync(PIN_KEY, pin);
    await SecureStore.setItemAsync(ENABLED_KEY, "1");
  },

  // Désactive entièrement le verrouillage (efface le code et les réglages).
  async disableLock(): Promise<void> {
    if (WEB) return;
    await SecureStore.deleteItemAsync(PIN_KEY);
    await SecureStore.deleteItemAsync(ENABLED_KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
  },

  async setPin(pin: string): Promise<void> {
    if (WEB) return;
    await SecureStore.setItemAsync(PIN_KEY, pin);
  },

  async verifyPin(pin: string): Promise<boolean> {
    if (WEB) return false;
    const stored = await SecureStore.getItemAsync(PIN_KEY);
    return !!stored && stored === pin;
  },

  async setBiometric(on: boolean): Promise<void> {
    if (WEB) return;
    await SecureStore.setItemAsync(BIOMETRIC_KEY, on ? "1" : "0");
  },
};

// Biométrie disponible ET configurée sur l'appareil.
export async function isBiometricAvailable(): Promise<boolean> {
  if (WEB) return false;
  const [hasHardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && enrolled;
}

// Lance l'invite biométrique. Renvoie true si l'authentification a réussi.
export async function authenticateBiometric(): Promise<boolean> {
  if (WEB) return false;
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: "Déverrouiller Hygiena+",
      cancelLabel: "Annuler",
    });
    return res.success;
  } catch {
    return false;
  }
}
