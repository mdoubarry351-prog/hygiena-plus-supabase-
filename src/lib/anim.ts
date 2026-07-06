import { Platform } from "react-native";

// Le pilote d'animation natif n'existe pas sur le web (react-native-web
// affiche un avertissement et retombe sur JS). On ne l'active que sur natif.
export const NATIVE_ANIM = Platform.OS !== "web";
