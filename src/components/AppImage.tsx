import { Image, type ImageContentFit, type ImageSource } from "expo-image";
import { type StyleProp, type ImageStyle } from "react-native";
import { colors, durations } from "@/theme";

// Placeholder doux pendant le chargement (couleur surface du thème, visible
// tant que l'image n'est pas chargée puis recouverte par le fondu).
const PLACEHOLDER_COLOR = colors.surface;

type Props = {
  source?: string | ImageSource | number | null;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  placeholderContentFit?: ImageContentFit;
  transitionMs?: number;
  accessibilityLabel?: string;
};

/**
 * Wrapper d'image premium basé sur expo-image :
 * - cache mémoire + disque (plus de rechargement à chaque affichage),
 * - fondu (transition) doux à l'apparition,
 * - placeholder gris (fond `surface`) pendant le chargement.
 * API simple, proche de <Image> RN — remplace facilement les images distantes.
 */
export function AppImage({
  source,
  style,
  contentFit = "cover",
  placeholderContentFit,
  transitionMs = durations.normal,
  accessibilityLabel,
}: Props) {
  // Normalise une URL string en { uri } ; conserve require(...) (number) et { uri }.
  const normalized: ImageSource | number | undefined =
    source == null
      ? undefined
      : typeof source === "string"
        ? { uri: source }
        : source;

  return (
    <Image
      source={normalized}
      style={[{ backgroundColor: PLACEHOLDER_COLOR }, style]}
      contentFit={contentFit}
      placeholderContentFit={placeholderContentFit}
      cachePolicy="memory-disk"
      transition={transitionMs}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
