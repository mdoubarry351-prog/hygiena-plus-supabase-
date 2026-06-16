import { Image, StyleSheet, View } from "react-native";
import { colors } from "@/theme";

const logo = require("../../assets/logo/hygiena-icon-drop.png");

// Logo « goutte » dans un halo mint — même style/dimensions que l'en-tête de
// login.tsx (halo 124, image 78, contain). Centré, décoratif. Réutilisé pour
// harmoniser les écrans d'authentification (register, mot de passe oublié).
const HALO = 124;

export function AuthLogo() {
  return (
    <View style={styles.halo}>
      <Image source={logo} style={styles.img} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  halo: {
    width: HALO, height: HALO, borderRadius: HALO / 2, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center", alignSelf: "center",
    shadowColor: colors.primaryDark, shadowOpacity: 0.15, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 4,
  },
  img: { width: 78, height: 78 },
});
