import { supabase } from "@/lib/supabase";
import type {
  Doctor,
  Appointment,
  Profile,
  Json,
  AppointmentStatus,
} from "@/lib/database.types";

// Profil patient joint sur un rendez-vous (ce dont l'UI médecin a besoin).
export type PatientProfile = Pick<Profile, "full_name" | "phone" | "avatar_url">;

// Rendez-vous enrichi avec le patient concerné (null si profil illisible).
export type AppointmentWithPatient = Appointment & { patient: PatientProfile | null };

// -----------------------------------------------------
// Disponibilité hebdomadaire — forme stockée dans doctors.availability (jsonb)
// -----------------------------------------------------
export type DayKey =
  | "monday" | "tuesday" | "wednesday" | "thursday"
  | "friday" | "saturday" | "sunday";

export type DayAvailability = { enabled: boolean; hours: string };
export type WeeklyAvailability = Record<DayKey, DayAvailability>;

export const WEEKDAYS: { key: DayKey; label: string }[] = [
  { key: "monday", label: "Lundi" },
  { key: "tuesday", label: "Mardi" },
  { key: "wednesday", label: "Mercredi" },
  { key: "thursday", label: "Jeudi" },
  { key: "friday", label: "Vendredi" },
  { key: "saturday", label: "Samedi" },
  { key: "sunday", label: "Dimanche" },
];

const DEFAULT_HOURS = "09:00 - 17:00";

// Disponibilité par défaut : semaine ouvrée activée, week-end désactivé.
export function defaultAvailability(): WeeklyAvailability {
  const out = {} as WeeklyAvailability;
  for (const { key } of WEEKDAYS) {
    const isWeekend = key === "saturday" || key === "sunday";
    out[key] = { enabled: !isWeekend, hours: DEFAULT_HOURS };
  }
  return out;
}

// Normalise une valeur jsonb (potentiellement nulle ou partielle) en structure
// complète et sûre pour le formulaire.
export function parseAvailability(value: Json | null | undefined): WeeklyAvailability {
  const base = defaultAvailability();
  if (!value || typeof value !== "object" || Array.isArray(value)) return base;
  const obj = value as Record<string, unknown>;
  for (const { key } of WEEKDAYS) {
    const raw = obj[key];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const day = raw as Record<string, unknown>;
      base[key] = {
        enabled: typeof day.enabled === "boolean" ? day.enabled : base[key].enabled,
        hours: typeof day.hours === "string" ? day.hours : base[key].hours,
      };
    }
  }
  return base;
}

// -----------------------------------------------------
// Statistiques du tableau de bord
// -----------------------------------------------------
export type DoctorStats = {
  total: number;
  today: number;
  upcoming: number; // à venir (date >= aujourd'hui) et non annulés/terminés
  pending: number; // en attente de confirmation
  completed: number;
};

const ACTIVE_STATUSES: AppointmentStatus[] = ["pending", "confirmed"];

export function computeStats(appts: AppointmentWithPatient[], todayISO: string): DoctorStats {
  return appts.reduce<DoctorStats>(
    (s, a) => {
      s.total += 1;
      if (a.appointment_date === todayISO) s.today += 1;
      if (a.appointment_date >= todayISO && ACTIVE_STATUSES.includes(a.status)) s.upcoming += 1;
      if (a.status === "pending") s.pending += 1;
      if (a.status === "completed") s.completed += 1;
      return s;
    },
    { total: 0, today: 0, upcoming: 0, pending: 0, completed: 0 }
  );
}

// Date du jour au format "YYYY-MM-DD" (heure locale).
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const doctorService = {
  // Fiche du médecin connecté (RLS : doctors_manage_own / select sur sa propre ligne).
  async getMyDoctor(userId: string): Promise<Doctor | null> {
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // Rendez-vous concernant ce médecin, du plus proche au plus lointain,
  // avec le patient joint (nom + téléphone pour le contacter).
  async getMyAppointments(doctorId: string): Promise<AppointmentWithPatient[]> {
    const { data, error } = await supabase
      .from("appointments")
      .select("*, patient:profiles!appointments_patient_id_fkey(full_name, phone, avatar_url)")
      .eq("doctor_id", doctorId)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });
    if (error) throw error;
    return (data ?? []) as AppointmentWithPatient[];
  },

  // Change le statut d'un rendez-vous (confirmer / annuler / terminer).
  async updateStatus(appointmentId: string, status: AppointmentStatus): Promise<void> {
    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", appointmentId);
    if (error) throw error;
  },

  // Met à jour la disponibilité hebdomadaire (champ jsonb).
  async updateAvailability(doctorId: string, availability: WeeklyAvailability): Promise<void> {
    const { error } = await supabase
      .from("doctors")
      .update({ availability: availability as unknown as Json })
      .eq("id", doctorId);
    if (error) throw error;
  },

  // Met à jour la fiche médecin (spécialité, bio, tarif).
  async updateProfile(
    doctorId: string,
    patch: { specialty: string; bio: string | null; consultation_fee: number | null; clinic_name: string | null }
  ): Promise<Doctor> {
    const { data, error } = await supabase
      .from("doctors")
      .update(patch)
      .eq("id", doctorId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },
};
