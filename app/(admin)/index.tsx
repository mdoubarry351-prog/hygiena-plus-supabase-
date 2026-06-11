import { Redirect } from "expo-router";

// L'accueil admin renvoie vers le tableau de bord : la navigation se fait
// désormais par le menu latéral (drawer mobile / sidebar desktop).
export default function AdminIndex() {
  return <Redirect href="/(admin)/dashboard" />;
}
