import type { Href } from "expo-router";

// Contexte de navigation transporté par une notification (colonne data jsonb
// pour les notifs in-app, et payload `data` du push Expo).
export type NotifData = {
  kind?: string;
  type?: string | null;
  postId?: string;
  appointmentId?: string;
  doctorId?: string;
  patientId?: string;
} | null;

// Destination d'une notification selon `data.kind` puis repli sur `type`.
// SOURCE UNIQUE réutilisée par l'écran notifications (tap in-app) ET le provider
// (tap sur une push/locale). Renvoie null si aucune navigation pertinente.
export function notificationRoute(data: NotifData, type: string | null): Href | null {
  switch (data?.kind) {
    case "post":
      return data?.postId ? { pathname: "/(user)/community/[id]", params: { id: data.postId } } : null;
    case "orders":
      return "/(user)/marketplace/orders";
    case "my_appointments":
      return "/(user)/appointments/mine";
    case "doctor_appointments":
      return "/(doctor)/appointments";
    case "patient_chat":
      return data?.doctorId ? { pathname: "/(user)/appointments/chat", params: { doctorId: data.doctorId } } : null;
    case "doctor_chat":
      return data?.patientId ? { pathname: "/(doctor)/chat", params: { patientId: data.patientId } } : null;
    case "premium":
      return "/(user)/premium";
  }
  const t = type ?? "";
  if (t.startsWith("cycle_")) return "/(user)/cycle/calendar";
  if (t.startsWith("premium_")) return "/(user)/premium";
  return null;
}

// Destination depuis le payload `data` reçu au tap d'une push/locale. Lit `type`
// dans data (le push serveur l'y inclut). Ajoute un repli pour les rappels
// LOCAUX (kind « cycle_… » / « appt_… ») qui n'ont pas de `type`.
export function notificationRouteFromTapData(raw: unknown): Href | null {
  const data = (raw && typeof raw === "object" ? raw : null) as NotifData;
  const route = notificationRoute(data, data?.type ?? null);
  if (route) return route;
  const k = data?.kind ?? "";
  if (k.startsWith("cycle")) return "/(user)/cycle/calendar";
  if (k.startsWith("appt")) return "/(user)/appointments/mine";
  return null;
}
