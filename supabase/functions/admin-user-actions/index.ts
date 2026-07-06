// =====================================================
// Hygiena+ — Edge Function : admin-user-actions
// (source importée de la version live v4, P0-6 ; CORS durci via _shared, P2)
//
// Contrôle d'accès (vérifié à l'audit) :
//  - delete_self : uniquement le compte de l'APPELANT (jamais un user_id du body) ;
//  - toute autre action exige profiles.role = 'admin' (lu via service_role),
//    sinon 403 — équivalent is_admin() côté Edge.
// =====================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, preflight } from "../_shared/http.ts";

const BAN_DURATION = "876000h";

function normalizePhone(raw: string): string {
  let p = (raw || "").replace(/[^0-9+]/g, "");
  if (p.startsWith("+")) return p;
  p = p.replace(/^0+/, "");
  if (p.startsWith("224")) return "+" + p;
  return "+224" + p;
}

function tempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 12; i++) s += chars[arr[i] % chars.length];
  return s + "!2";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Non authentifie" }, 401);

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Session invalide" }, 401);
  const callerId = userData.user.id;

  const admin = createClient(url, serviceKey);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return json({ error: "Corps de requete invalide" }, 400); }
  const action = payload.action as string | undefined;
  if (!action) return json({ error: "Action manquante" }, 400);

  // Action accessible a TOUT utilisateur connecte : supprimer SON PROPRE compte
  if (action === "delete_self") {
    try {
      const { error } = await admin.auth.admin.deleteUser(callerId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, action, user_id: callerId });
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  }

  // Toutes les autres actions sont reservees aux admins
  const { data: prof, error: profErr } = await admin.from("profiles").select("role").eq("id", callerId).single();
  if (profErr || !prof || prof.role !== "admin") {
    return json({ error: "Action reservee aux administrateurs" }, 403);
  }

  try {
    if (action === "delete_user" || action === "ban_user" || action === "unban_user") {
      const user_id = payload.user_id as string | undefined;
      if (!user_id) return json({ error: "user_id manquant" }, 400);
      if (user_id === callerId) return json({ error: "Action impossible sur votre propre compte" }, 400);
      if (action === "delete_user") {
        const { error } = await admin.auth.admin.deleteUser(user_id);
        if (error) return json({ error: error.message }, 400);
      } else {
        const { error } = await admin.auth.admin.updateUserById(user_id, {
          ban_duration: action === "ban_user" ? BAN_DURATION : "none",
        });
        if (error) return json({ error: error.message }, 400);
      }
      return json({ success: true, action, user_id });
    }

    if (action === "create_doctor") {
      const firstName = ((payload.firstName as string) || "").trim();
      const lastName = ((payload.lastName as string) || "").trim();
      const phoneRaw = (payload.phone as string) || "";
      const email = ((payload.email as string) || "").trim() || null;
      const specialty = ((payload.specialty as string) || "").trim();
      const yearsExperience = payload.yearsExperience != null ? Number(payload.yearsExperience) : null;
      const consultationFee = payload.consultationFeeGNF != null ? Number(payload.consultationFeeGNF) : 75000;
      const bio = ((payload.bio as string) || "").trim() || null;
      const clinicName = ((payload.clinicName as string) || "").trim() || null;
      const avatarUrl = ((payload.avatarUrl as string) || "").trim() || null;
      const isValidated = payload.isValidated !== false;

      if (!firstName) return json({ error: "Nom complet requis" }, 400);
      if (!specialty) return json({ error: "Specialite requise" }, 400);
      if (!phoneRaw) return json({ error: "Telephone de connexion requis" }, 400);
      const phone = normalizePhone(phoneRaw);
      const password = tempPassword();
      const fullName = `${firstName} ${lastName}`.trim();

      const createRes = await admin.auth.admin.createUser({
        phone, email: email ?? undefined, password,
        phone_confirm: true, email_confirm: email ? true : undefined,
        user_metadata: { full_name: fullName },
      });
      if (createRes.error || !createRes.data?.user) {
        return json({ error: createRes.error?.message || "Creation du compte echouee" }, 400);
      }
      const newId = createRes.data.user.id;

      const { error: pErr } = await admin.from("profiles").upsert({
        id: newId, email, phone, role: "doctor",
        first_name: firstName, last_name: lastName || null, full_name: fullName, avatar_url: avatarUrl,
      }, { onConflict: "id" });
      if (pErr) { await admin.auth.admin.deleteUser(newId); return json({ error: "Profil: " + pErr.message }, 400); }

      const { error: dErr } = await admin.from("doctors").insert({
        user_id: newId, specialty, bio, consultation_fee: consultationFee,
        years_experience: yearsExperience, clinic_name: clinicName,
        is_validated: isValidated, validated_by: isValidated ? callerId : null,
        validated_at: isValidated ? new Date().toISOString() : null,
      });
      if (dErr) { await admin.auth.admin.deleteUser(newId); return json({ error: "Fiche medecin: " + dErr.message }, 400); }

      await admin.from("admin_logs").insert({
        admin_id: callerId, action: "create_doctor", target_table: "doctors", target_id: newId,
        details: { full_name: fullName, specialty },
      });
      return json({ success: true, action, user_id: newId, temp_password: password, phone, email });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
