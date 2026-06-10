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
  async createAppointment(input: {
    patientId: string;
    doctorId: string;
    date: string;
    time: string;
    reason?: string | null;
  }): Promise<Appointment> {
    const payload: TablesInsert<"appointments"> = {
      patient_id: input.patientId,
      doctor_id: input.doctorId,
      appointment_date: input.date,
      appointment_time: input.time,
      status: "pending",
      reason: input.reason ?? null,
    };
    const { data, error } = await supabase
      .from("appointments")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },
};
