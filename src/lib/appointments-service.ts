import { supabase } from "@/lib/supabase";
import type {
  Doctor,
  Appointment,
  Profile,
  Json,
  TablesInsert,
} from "@/lib/database.types";

// =====================================================
// Disponibilités du médecin (doctors.availability jsonb) :
// { monday: { enabled, hours: "09:00 - 13:00" }, ... } (clés monday..sunday).
// =====================================================
// getDay() : 0 = dimanche … 6 = samedi → clés correspondantes.
const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

// Jours de la semaine ordonnés (Lun→Dim) avec libellé court, pour l'aperçu des dispos.
export const WEEK_DAYS: { key: string; label: string }[] = [
  { key: "monday", label: "Lun" },
  { key: "tuesday", label: "Mar" },
  { key: "wednesday", label: "Mer" },
  { key: "thursday", label: "Jeu" },
  { key: "friday", label: "Ven" },
  { key: "saturday", label: "Sam" },
  { key: "sunday", label: "Dim" },
];

export type DayAvailability = { start: string; end: string };

// Clé de jour (« monday »…) pour une date ISO « YYYY-MM-DD ».
export function dayKeyForDate(dateISO: string): string {
  return DAY_KEYS[new Date(`${dateISO}T12:00:00`).getDay()];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Parse « 09:00 - 13:00 » (espaces optionnels) → { start, end } normalisés.
function parseHours(hours: string): DayAvailability | null {
  const m = hours.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { start: `${pad2(+m[1])}:${m[2]}`, end: `${pad2(+m[3])}:${m[4]}` };
}

// Disponibilité d'un jour donné (null si non travaillé / mal formé).
export function dayAvailability(availability: Json | null, dayKey: string): DayAvailability | null {
  if (!availability || typeof availability !== "object" || Array.isArray(availability)) return null;
  const day = (availability as Record<string, unknown>)[dayKey];
  if (!day || typeof day !== "object") return null;
  const obj = day as { enabled?: boolean; hours?: string };
  if (!obj.enabled || !obj.hours) return null;
  return parseHours(obj.hours);
}

// Le médecin a-t-il au moins un jour de disponibilité défini ?
export function hasAnyAvailability(availability: Json | null): boolean {
  return DAY_KEYS.some((k) => dayAvailability(availability, k) !== null);
}

// Génère les créneaux de `stepMin` minutes entre start et end (« HH:MM »).
export function generateSlots(start: string, end: string, stepMin = 30): string[] {
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const fromMin = (x: number) => `${pad2(Math.floor(x / 60))}:${pad2(x % 60)}`;
  const s = toMin(start), e = toMin(end);
  const out: string[] = [];
  for (let t = s; t + stepMin <= e; t += stepMin) out.push(fromMin(t));
  return out;
}

// Infos de profil jointes pour un médecin (uniquement ce dont l'UI a besoin).
export type DoctorProfile = Pick<Profile, "full_name" | "avatar_url">;

// Médecin enrichi avec le profil de la personne (nom, avatar).
export type DoctorWithProfile = Doctor & { profile: DoctorProfile | null };

// Médecin réduit tel que joint sur un rendez-vous (spécialité + nom).
export type AppointmentDoctor = Pick<Doctor, "specialty"> & {
  profile: DoctorProfile | null;
};

// Rendez-vous enrichi avec le médecin concerné (null si introuvable).
export type AppointmentWithDoctor = Appointment & {
  doctor: AppointmentDoctor | null;
};

// Médecin joint pour le reçu (avec nom de clinique).
export type ReceiptDoctor = Pick<Doctor, "specialty" | "clinic_name"> & {
  profile: DoctorProfile | null;
};

// Rendez-vous pour l'écran reçu (médecin + clinique).
export type AppointmentReceipt = Appointment & { doctor: ReceiptDoctor | null };

// Génère un numéro de reçu type « RCP-XXXXXXXX » (paiement simulé).
export function generateReceiptNumber(): string {
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RCP-${ts}${rand}`;
}

// Nom à afficher pour un médecin (repli sur « Médecin » si le profil est incomplet).
export function doctorDisplayName(profile: DoctorProfile | null): string {
  return profile?.full_name?.trim() || "Médecin";
}

// Formatage d'une date de rendez-vous (« lundi 15 juin 2026 ») à partir d'un
// libellé ISO court « YYYY-MM-DD ». On force midi pour éviter tout décalage de
// fuseau horaire qui ramènerait au jour précédent.
export function formatAppointmentDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Formatage d'une heure « HH:MM:SS » ou « HH:MM » en « HH:MM ».
export function formatAppointmentTime(time: string): string {
  return time.slice(0, 5);
}

export const appointmentsService = {
  // Médecins validés uniquement, avec leur profil (nom, avatar), triés par
  // spécialité pour une liste lisible.
  async getDoctors(): Promise<DoctorWithProfile[]> {
    const { data, error } = await supabase
      .from("doctors")
      .select("*, profile:profiles!doctors_user_id_fkey(full_name, avatar_url)")
      .eq("is_validated", true)
      .order("specialty", { ascending: true });
    if (error) throw error;
    return (data ?? []) as DoctorWithProfile[];
  },

  // Détail d'un médecin validé.
  async getDoctor(id: string): Promise<DoctorWithProfile | null> {
    const { data, error } = await supabase
      .from("doctors")
      .select("*, profile:profiles!doctors_user_id_fkey(full_name, avatar_url)")
      .eq("id", id)
      .eq("is_validated", true)
      .single();
    if (error) throw error;
    return data as DoctorWithProfile;
  },

  // Rendez-vous d'un utilisateur, les plus récents en premier, avec le médecin joint.
  async getAppointments(userId: string): Promise<AppointmentWithDoctor[]> {
    const { data, error } = await supabase
      .from("appointments")
      .select("*, doctor:doctors(specialty, profile:profiles!doctors_user_id_fkey(full_name, avatar_url))")
      .eq("patient_id", userId)
      .order("appointment_date", { ascending: false })
      .order("appointment_time", { ascending: false });
    if (error) throw error;
    return (data ?? []) as AppointmentWithDoctor[];
  },

  // Crée un rendez-vous. Le statut est « pending » par défaut côté base.
  // Si `payment` est fourni (paiement simulé confirmé) : is_paid=true + reçu.
  async createAppointment(input: {
    patientId: string;
    doctorId: string;
    date: string;
    time: string;
    reason?: string | null;
    payment?: { amountPaid: number; receiptNumber: string };
  }): Promise<Appointment> {
    const paid = input.payment;
    const payload: TablesInsert<"appointments"> = {
      patient_id: input.patientId,
      doctor_id: input.doctorId,
      appointment_date: input.date,
      appointment_time: input.time,
      status: "pending",
      reason: input.reason ?? null,
      is_paid: !!paid,
      amount_paid: paid ? paid.amountPaid : null,
      paid_at: paid ? new Date().toISOString() : null,
      receipt_number: paid ? paid.receiptNumber : null,
    };
    const { data, error } = await supabase
      .from("appointments")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  // Créneaux OCCUPÉS d'un médecin sur une plage de dates (via RPC sécurisée,
  // aucune info patiente exposée). Renvoie une liste { date, time(HH:MM) }.
  async getBookedSlots(doctorId: string, from: string, to: string): Promise<{ date: string; time: string }[]> {
    const { data, error } = await supabase.rpc("doctor_booked_slots", {
      p_doctor: doctorId,
      p_from: from,
      p_to: to,
    });
    if (error) throw error;
    return (data ?? []).map((r) => ({ date: r.appointment_date, time: r.appointment_time.slice(0, 5) }));
  },

  // La patiente annule son propre rendez-vous (RLS appointments_update_patient).
  async cancelAppointment(id: string): Promise<void> {
    const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
    if (error) throw error;
  },

  // La patiente reporte son rendez-vous (nouvelle date/heure → repasse en attente).
  async rescheduleAppointment(id: string, date: string, time: string): Promise<void> {
    const { error } = await supabase
      .from("appointments")
      .update({ appointment_date: date, appointment_time: time, status: "pending" })
      .eq("id", id);
    if (error) throw error;
  },

  // Rendez-vous unique avec médecin + clinique, pour l'écran reçu.
  async getAppointmentReceipt(id: string): Promise<AppointmentReceipt | null> {
    const { data, error } = await supabase
      .from("appointments")
      .select("*, doctor:doctors(specialty, clinic_name, profile:profiles!doctors_user_id_fkey(full_name, avatar_url))")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as AppointmentReceipt;
  },
};
