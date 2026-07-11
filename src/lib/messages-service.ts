import { supabase } from "@/lib/supabase";
import { appointmentsService } from "@/lib/appointments-service";
import type { DoctorMessage } from "@/lib/database.types";

export type { DoctorMessage };

// Conversation côté patient : un fil par praticien (avec RDV ou messages).
export type PatientConversation = {
  doctorId: string;
  doctorName: string;
  specialty: string | null;
  practitionerType: string | null;
  lastContent: string | null; // null = aucun message encore (RDV sans échange)
  lastAt: string;
  unreadCount: number;
};

// Conversation côté médecin : un fil par patiente.
export type DoctorConversation = {
  patientId: string;
  patientName: string;
  lastContent: string;
  lastAt: string;
  unreadCount: number;
};

// Noms + spécialité + type des praticiens (requête séparée — pas d'embed fragile).
async function fetchDoctorNames(ids: string[]): Promise<Map<string, { name: string; specialty: string | null; type: string | null }>> {
  const map = new Map<string, { name: string; specialty: string | null; type: string | null }>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase
    .from("doctors")
    .select("id, specialty, practitioner_type, profile:profiles!doctors_user_id_fkey(full_name)")
    .in("id", ids);
  if (error) throw error;
  const rows = (data ?? []) as { id: string; specialty: string | null; practitioner_type: string | null; profile: { full_name: string | null } | null }[];
  for (const d of rows) {
    map.set(d.id, { name: d.profile?.full_name?.trim() || "Praticien", specialty: d.specialty ?? null, type: d.practitioner_type ?? null });
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

  // Le patient écrit (RLS : autorisé si une relation patient ↔ médecin existe).
  async sendPatientMessage(patientId: string, doctorId: string, content: string): Promise<DoctorMessage> {
    const { data, error } = await supabase
      .from("doctor_messages")
      .insert({ patient_id: patientId, doctor_id: doctorId, sender_role: "patient", content })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  // Marque comme lus les messages reçus par l'appelant dans ce fil (RPC SECURITY DEFINER).
  // Best-effort : un échec ne doit jamais bloquer l'affichage du chat.
  async markThreadRead(doctorId: string, patientId: string): Promise<void> {
    const { error } = await supabase.rpc("mark_doctor_thread_read", { p_doctor: doctorId, p_patient: patientId });
    if (error) throw error;
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

  // Conversations de la patiente : un fil par praticien, regroupant les MESSAGES
  // et les RENDEZ-VOUS (pour accéder à la salle même sans message). Dernier
  // message + compteur de non-lus (messages du praticien non lus). Best-effort
  // sur les RDV (un échec ne masque pas les fils de messages).
  async listPatientConversations(patientId: string): Promise<PatientConversation[]> {
    const { data, error } = await supabase
      .from("doctor_messages")
      .select("doctor_id, content, created_at, sender_role, read_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const latest = new Map<string, { content: string; created_at: string }>();
    const unread = new Map<string, number>();
    for (const r of data ?? []) {
      if (!latest.has(r.doctor_id)) latest.set(r.doctor_id, { content: r.content, created_at: r.created_at });
      if (r.sender_role === "doctor" && !r.read_at) unread.set(r.doctor_id, (unread.get(r.doctor_id) ?? 0) + 1);
    }

    // RDV → praticiens éventuellement sans message encore (fallback date = created_at).
    const apptAt = new Map<string, string>();
    try {
      const appts = await appointmentsService.getAppointments(patientId);
      for (const a of appts) {
        if (a.doctor_id && !apptAt.has(a.doctor_id)) apptAt.set(a.doctor_id, a.created_at);
      }
    } catch {
      // best-effort
    }

    const allIds = Array.from(new Set([...latest.keys(), ...apptAt.keys()]));
    const names = await fetchDoctorNames(allIds);
    const items = allIds.map((doctorId) => {
      const l = latest.get(doctorId);
      const n = names.get(doctorId);
      return {
        doctorId,
        doctorName: n?.name ?? "Praticien",
        specialty: n?.specialty ?? null,
        practitionerType: n?.type ?? null,
        lastContent: l?.content ?? null,
        lastAt: l?.created_at ?? apptAt.get(doctorId) ?? "",
        unreadCount: unread.get(doctorId) ?? 0,
      };
    });
    items.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
    return items;
  },

  // Liste des fils du médecin (un par patiente) : dernier message + non-lus
  // (messages de la patiente non lus).
  async getDoctorConversations(doctorId: string): Promise<DoctorConversation[]> {
    const { data, error } = await supabase
      .from("doctor_messages")
      .select("patient_id, content, created_at, sender_role, read_at")
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const latest = new Map<string, { content: string; created_at: string }>();
    const unread = new Map<string, number>();
    for (const r of data ?? []) {
      if (!latest.has(r.patient_id)) latest.set(r.patient_id, { content: r.content, created_at: r.created_at });
      if (r.sender_role === "patient" && !r.read_at) unread.set(r.patient_id, (unread.get(r.patient_id) ?? 0) + 1);
    }
    const ids = Array.from(latest.keys());
    const names = await fetchPatientNames(ids);
    return ids.map((patientId) => {
      const l = latest.get(patientId)!;
      return { patientId, patientName: names.get(patientId) ?? "Patiente", lastContent: l.content, lastAt: l.created_at, unreadCount: unread.get(patientId) ?? 0 };
    });
  },
};
