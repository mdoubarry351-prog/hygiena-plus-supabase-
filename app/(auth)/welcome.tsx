import { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { FadeInView } from "@/components/FadeInView";
import { colors, spacing, typography } from "@/theme";

const logo = require("../../assets/logo/hygiena-icon-drop.png");

export default function Welcome() {
  const router = useRouter();
  // « Pop » doux du logo au lancement (spring scale), première impression.
  const pop = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 9, bounciness: 10 }).start();
  }, [pop]);
  return (
    <Screen>
      <View style={styles.glow} pointerEvents="none" />
      <FadeInView>
        <View style={styles.container}>
          <View style={styles.header}>
            <Animated.View style={[styles.logoHalo, { transform: [{ scale: pop }] }]}>
              <Image source={logo} style={styles.logoImg} resizeMode="contain" />
            </Animated.View>
            <Text style={styles.wordmark}>
              Hygiena<Text style={styles.plus}>+</Text>
            </Text>
            <Text style={styles.tagline}>Ta santé féminine, accompagnée au quotidien 🌿</Text>
          </View>

          <View style={styles.actions}>
            <Button title="Se connecter" onPress={() => router.push("/(auth)/login")} />
            <Button title="Créer un compte" variant="outline" onPress={() => router.push("/(auth)/register")} />
          </View>
        </View>
      </FadeInView>
    </Screen>
  );
}

const HALO = 132;
const styles = StyleSheet.create({
  glow: {
    position: "absolute", top: -150, left: -60, right: -60, height: 340,
    borderRadius: 200, backgroundColor: colors.primaryLight, opacity: 0.5,
  },
  container: { flex: 1, justifyContent: "space-between", paddingVertical: spacing.xxl },
  header: { alignItems: "center", marginTop: spacing.xxl, gap: spacing.sm },
  logoHalo: {
    width: HALO, height: HALO, borderRadius: HALO / 2, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.primaryDark, shadowOpacity: 0.15, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 4,
  },
  logoImg: { width: 84, height: 84 },
  wordmark: { fontSize: 34, fontWeight: "700", color: colors.primaryDark, marginTop: spacing.sm, letterSpacing: 0.3 },
  plus: { color: colors.accent, fontWeight: "700" },
  tagline: { ...typography.body, color: colors.textMuted, textAlign: "center", paddingHorizontal: spacing.lg },
  actions: { gap: spacing.sm },
});
