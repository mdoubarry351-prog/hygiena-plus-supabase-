import { useState } from "react";
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { FadeInView } from "@/components/FadeInView";
import { colors, phase, radius, spacing, typography } from "@/theme";

// Active l'animation de dépliage sur Android.
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Section = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  title: string;
  // Paragraphes ou puces (préfixées « • ») affichés une fois la carte dépliée.
  body: string[];
};

// Contenu éducatif statique — langage simple, bienveillant, non prescriptif.
const SECTIONS: Section[] = [
  {
    key: "phases",
    icon: "sync-outline",
    tint: colors.primary,
    title: "Les phases du cycle",
    body: [
      "Un cycle dure en moyenne 28 jours, mais entre 21 et 35 jours reste tout à fait courant. Il se découpe en quatre phases.",
      "• Phase menstruelle : ce sont les règles. La muqueuse de l'utérus s'élimine, généralement sur 3 à 7 jours.",
      "• Phase folliculaire : juste après les règles, le corps prépare un ovule. L'énergie remonte souvent peu à peu.",
      "• Ovulation : un ovule est libéré, en milieu de cycle environ. C'est la période la plus fertile.",
      "• Phase lutéale : après l'ovulation et jusqu'aux règles suivantes. Certaines ressentent des signes prémenstruels (fatigue, sensibilité, humeur changeante).",
    ],
  },
  {
    key: "ovulation",
    icon: "ellipse-outline",
    tint: phase.ovulation,
    title: "L'ovulation",
    body: [
      "L'ovulation, c'est le moment où un ovaire libère un ovule. Elle survient en moyenne autour de 14 jours avant les règles suivantes — pas forcément au « jour 14 » du cycle.",
      "Sa date peut varier d'un cycle à l'autre, surtout si les cycles sont irréguliers. Certaines remarquent de légers signes (douleur d'un côté du bas-ventre, changement des pertes), d'autres rien du tout : les deux sont normaux.",
    ],
  },
  {
    key: "fertile",
    icon: "leaf-outline",
    tint: phase.fertile,
    title: "La fenêtre fertile",
    body: [
      "La fenêtre fertile regroupe les jours où une grossesse est possible : environ les 5 jours qui précèdent l'ovulation, plus le jour de l'ovulation.",
      "Pourquoi ces jours ? Parce que les spermatozoïdes peuvent survivre plusieurs jours, et l'ovule reste fécondable environ 24 heures après sa libération.",
      "Les estimations de l'application sont indicatives : elles aident à se repérer, mais ne remplacent pas une méthode contraceptive fiable.",
    ],
  },
  {
    key: "irregular",
    icon: "pulse-outline",
    tint: phase.period,
    title: "Les irrégularités fréquentes",
    body: [
      "Des variations d'un cycle à l'autre sont normales. Un cycle un peu plus court ou plus long, un retard de quelques jours, un stress ou un voyage qui décale tout : cela arrive à beaucoup de personnes.",
      "Les premières années après les premières règles, et la période autour de la ménopause, sont souvent plus irrégulières.",
      "Quand en parler à un professionnel de santé : si les cycles deviennent très irréguliers de façon durable, s'ils sont très courts (moins de 21 jours) ou très longs (plus de 35-40 jours), si les règles sont très douloureuses ou très abondantes, ou en cas d'absence prolongée de règles. Il n'y a pas de raison de s'alarmer, mais un avis médical permet d'y voir clair.",
    ],
  },
];

export default function CycleLearn() {
  const [open, setOpen] = useState<string | null>("phases");

  function toggle(key: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((cur) => (cur === key ? null : key));
  }

  return (
    <Screen>
      <FadeInView>
        <ScreenHeader title="Comprendre mon cycle" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Text style={styles.intro}>
            Quelques repères simples pour mieux comprendre ce qui se passe au fil du mois. Chaque corps est différent : ces explications sont générales et bienveillantes.
          </Text>

          {SECTIONS.map((s) => {
            const expanded = open === s.key;
            return (
              <Card key={s.key} style={styles.card}>
                <Pressable onPress={() => toggle(s.key)} style={styles.head} accessibilityRole="button" accessibilityLabel={s.title}>
                  <View style={[styles.icon, { backgroundColor: s.tint + "22" }]}>
                    <Ionicons name={s.icon} size={20} color={s.tint} />
                  </View>
                  <Text style={styles.title}>{s.title}</Text>
                  <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
                </Pressable>

                {expanded ? (
                  <View style={styles.body}>
                    {s.body.map((p, i) => (
                      <Text key={i} style={p.startsWith("•") ? styles.bullet : styles.paragraph}>{p}</Text>
                    ))}
                  </View>
                ) : null}
              </Card>
            );
          })}

          <MedicalDisclaimer text="Ces informations sont éducatives et ne remplacent pas l'avis d'un professionnel de santé." />
        </ScrollView>
      </FadeInView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  intro: { ...typography.body, color: colors.textMuted, lineHeight: 21 },
  card: { gap: 0, paddingVertical: spacing.sm },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  icon: { width: 38, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  title: { ...typography.name, flex: 1 },
  body: { gap: spacing.sm, marginTop: spacing.sm, paddingLeft: 2 },
  paragraph: { ...typography.body, color: colors.text, lineHeight: 21 },
  bullet: { ...typography.body, color: colors.text, lineHeight: 21 },
});
