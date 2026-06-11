import { supabase } from "@/lib/supabase";
import type { DoctorMessage } from "@/lib/database.types";

export type { DoctorMessage };

// Conversation côté patient : un fil par médecin.
export type PatientConversation = {
  doctorId: string;
  doctorName: string;
  specialty: string | null;
  lastContent: string;
  lastAt: string;
};

// Conversation côté médecin : un fil par patiente.
export type DoctorConversation = {
  patientId: string;
  patientName: string;
  lastContent: string;
  lastAt: string;
};

// Noms des médecins (requête séparée — pas d'embed FK fragile via une vue).
async function fetchDoctorNames(ids: string[]): Promise<Map<string, { name: string; specialty: string | null }>> {
  const map = new Map<string, { name: string; specialty: string | null }>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase
    .from("doctors")
    .select("id, specialty, profile:profiles!doctors_user_id_fkey(full_name)")
    .in("id", ids);
  if (error) throw error;
  const rows = (data ?? []) as { id: string; specialty: string | null; profile: { full_name: string | null } | null }[];
  for (const d of rows) {
    map.set(d.id, { name: d.profile?.full_name?.trim() || "Médecin", specialty: d.specialty ?? null });
  }
  return map;
}

// Noms des patientes (requête séparée).
async function fetchPatientNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  if (error) throw error;
  for (const p of data ?? []) map.set(p.id, p.full_name?.trim() || "Patiente");
  return map;
}

export const messagesService = {
  // Fil complet patient ↔ médecin (ordre chronologique).
  async getThread(patientId: string, doctorId: string): Promise<DoctorMessage[]> {
    const { data, error } = await supabase
      .from("doctor_messages")
      .select("*")
      .eq("patient_id", patientId)
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  // Le patient écrit (RLS : autorisé seulement si profiles.is_premium = true).
  async sendPatientMessage(patientId: string, doctorId: string, content: string): Promise<DoctorMessage> {
    const { data, error } = await supabase
      .from("doctor_messages")
      .insert({ patient_id: patientId, doctor_id: doctorId, sender_role: "patient", content })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  // Le médecin répond sur l'un de ses fils.
  async sendDoctorMessage(patientId: string, doctorId: string, content: string): Promise<DoctorMessage> {
    const { data, error } = await supabase
      .from("doctor_messages")
      .insert({ patient_id: patientId, doctor_id: doctorId, sender_role: "doctor", content })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  // Liste des fils du patient (un par médecin) avec dernier message.
  async getPatientConversations(patientId: string): Promise<PatientConversation[]> {
    const { data, error } = await supabase
      .from("doctor_messages")
      .select("doctor_id, content, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const latest = new Map<string, { content: string; created_at: string }>();
    for (const r of data ?? []) {
      if (!latest.has(r.doctor_id)) latest.set(r.doctor_id, { content: r.content, created_at: r.created_at });
    }
    const ids = Array.from(latest.keys());
    const names = await fetchDoctorNames(ids);
    return ids.map((doctorId) => {
      const l = latest.get(doctorId)!;
      const n = names.get(doctorId);
      return { doctorId, doctorName: n?.name ?? "Médecin", specialty: n?.specialty ?? null, lastContent: l.content, lastAt: l.created_at };
    });
  },

  // Liste des fils du médecin (un par patiente) avec dernier message.
  async getDoctorConversations(doctorId: string): Promise<DoctorConversation[]> {
    const { data, error } = await supabase
      .from("doctor_messages")
      .select("patient_id, content, created_at")
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const latest = new Map<string, { content: string; created_at: string }>();
    for (const r of data ?? []) {
      if (!latest.has(r.patient_id)) latest.set(r.patient_id, { content: r.content, created_at: r.created_at });
    }
    const ids = Array.from(latest.keys());
    const names = await fetchPatientNames(ids);
    return ids.map((patientId) => {
      const l = latest.get(patientId)!;
      return { patientId, patientName: names.get(patientId) ?? "Patiente", lastContent: l.content, lastAt: l.created_at };
    });
  },
};
