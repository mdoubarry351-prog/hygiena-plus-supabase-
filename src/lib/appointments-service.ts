import { supabase } from "@/lib/supabase";
import type {
  Doctor,
  Appointment,
  Profile,
  TablesInsert,
} from "@/lib/database.types";

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
