import { BouncyIcon } from "@/components/BouncyIcon";
import { colors } from "@/theme";

/**
 * Cœur animé : « pop » (ressort scale) au changement d'état aimé/non aimé.
 * Composant PUREMENT visuel — le toggle optimiste + l'haptique restent gérés
 * par le parent. Le pop est délégué à BouncyIcon (moteur reanimated partagé).
 */
export function HeartButton({
  active,
  size = 20,
  activeColor = colors.primary,
  inactiveColor = colors.textMuted,
}: {
  active: boolean;
  size?: number;
  activeColor?: string;
  inactiveColor?: string;
}) {
  return (
    <BouncyIcon
      name={active ? "heart" : "heart-outline"}
      size={size}
      color={active ? activeColor : inactiveColor}
      popKey={active}
    />
  );
}
