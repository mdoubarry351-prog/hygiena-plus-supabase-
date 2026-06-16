import { Platform, type ViewStyle } from "react-native";

// Curseur « main » sur web pour les éléments cliquables (Pressable/Card/Button).
// No-op sur mobile (null → ignoré dans les tableaux de style). `cursor` fait
// partie de ViewStyle (RN 0.81) → pas de cast nécessaire.
export const webPointer: ViewStyle | null = Platform.OS === "web" ? { cursor: "pointer" } : null;
