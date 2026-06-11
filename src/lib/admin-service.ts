import { supabase } from "@/lib/supabase";
import { communityService, type CommunityPostWithAuthor } from "@/lib/community-service";
import type {
  Profile,
  Doctor,
  MarketplaceProduct,
  MarketplaceOrder,
  UserReport,
  UserSuspension,
  AppSettings,
  UserRole,
  OrderStatus,
  Json,
  TablesInsert,
  TablesUpdate,
} from "@/lib/database.types";

// =====================================================
// Logging centralisé de toute action sensible dans admin_logs.
// Best-effort : un échec de log n'interrompt pas l'action déjà réalisée.
// =====================================================
async function logAction(
  adminId: string,
  action: string,
  targetTable: string | null,
  targetId: string | null,
  details: Json | null = null
): Promise<void> {
  const payload: TablesInsert<"admin_logs"> = {
    admin_id: adminId,
    action,
    target_table: targetTable,
    target_id: targetId,
    details,
  };
  const { error } = await supabase.from("admin_logs").insert(payload);
  if (error) console.warn("admin_logs (log non enregistré):", error.message);
}

// Invoque l'Edge Function admin-user-actions (service role côté serveur).
// Le JWT admin de l'appelant est envoyé automatiquement par supabase-js.
type AdminUserAction = "delete_user" | "ban_user" | "unban_user";
async function invokeAdminUserAction(action: AdminUserAction, userId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("admin-user-actions", {
    body: { action, user_id: userId },
  });
  if (error) {
    let message = error.message || "Action administrateur échouée";
    try {
      const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
      const body = ctx?.json ? ((await ctx.json()) as { error?: string }) : null;
      if (body?.error) message = body.error;
    } catch {
      // on garde le message par défaut
    }
    throw new Error(message);
  }
  const body = data as { success?: boolean; error?: string } | null;
  if (body?.error) throw new Error(body.error);
}

// ----- Types enrichis (jointures) -----
export type DoctorRow = Doctor & {
  profile: Pick<Profile, "full_name" | "email"> | null;
};
export type ReportRow = UserReport & {
  reporter: Pick<Profile, "full_name"> | null;
  reported: Pick<Profile, "full_name"> | null;
};
export type SuspensionRow = UserSuspension & {
  user: Pick<Profile, "full_name" | "email"> | null;
};

export type AdminCounts = {
  users: number;
  doctors: number;
  orders: number;
  posts: number;
  appointments: number;
};

export type MonthlySeries = {
  months: string[];
  signups: number[];
  orders: number[];
};

export type DashboardStats = {
  users: number;
  doctors: number;
  posts: number;
  appointments: number;
  revenueThisMonth: number;
  ordersPending: number;
  ordersThisMonth: number;
  outOfStock: number;
};

// Statuts possibles d'un signalement (user_reports.status est un text libre).
export const REPORT_STATUSES = ["pending", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

type CountableTable =
  | "profiles"
  | "doctors"
  | "marketplace_orders"
  | "community_posts"
  | "appointments";

async function countRows(table: CountableTable): Promise<number> {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export const adminService = {
  // ---------------- 1. Dashboard ----------------
  async getCounts(): Promise<AdminCounts> {
    const [users, doctors, orders, posts, appointments] = await Promise.all([
      countRows("profiles"),
      countRows("doctors"),
      countRows("marketplace_orders"),
      countRows("community_posts"),
      countRows("appointments"),
    ]);
    return { users, doctors, orders, posts, appointments };
  },

  // Statistiques du tableau de bord (léger : 4 counts + 1 requête commandes + 1 count rupture).
  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [users, doctors, posts, appointments, ordersRes, outOfStockRes] = await Promise.all([
      countRows("profiles"),
      countRows("doctors"),
      countRows("community_posts"),
      countRows("appointments"),
      supabase.from("marketplace_orders").select("status, total_amount, created_at"),
      supabase.from("marketplace_products").select("id", { count: "exact", head: true }).lte("stock", 0),
    ]);
    if (ordersRes.error) throw ordersRes.error;
    if (outOfStockRes.error) throw outOfStockRes.error;

    let revenueThisMonth = 0;
    let ordersPending = 0;
    let ordersThisMonth = 0;
    for (const o of ordersRes.data ?? []) {
      if (o.status === "pending") ordersPending += 1;
      const inMonth = (o.created_at ?? "") >= monthStart;
      if (inMonth) {
        ordersThisMonth += 1;
        // Le chiffre d'affaires exclut les commandes annulées.
        if (o.status !== "cancelled") revenueThisMonth += o.total_amount ?? 0;
      }
    }

    return {
      users,
      doctors,
      posts,
      appointments,
      revenueThisMonth,
      ordersPending,
      ordersThisMonth,
      outOfStock: outOfStockRes.count ?? 0,
    };
  },

  // ---------------- 2. Statistiques ----------------
  // Créations par mois sur les 6 derniers mois (inscriptions + commandes).
  async getMonthlySeries(): Promise<MonthlySeries> {
    const [profsRes, ordersRes] = await Promise.all([
      supabase.from("profiles").select("created_at"),
      supabase.from("marketplace_orders").select("created_at"),
    ]);
    if (profsRes.error) throw profsRes.error;
    if (ordersRes.error) throw ordersRes.error;

    const now = new Date();
    const buckets: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("fr-FR", { month: "short" }),
      });
    }
    const index: Record<string, number> = {};
    buckets.forEach((b, i) => (index[b.key] = i));

    const signups = new Array(6).fill(0);
    const orders = new Array(6).fill(0);
    for (const p of profsRes.data ?? []) {
      const k = (p.created_at ?? "").slice(0, 7);
      if (k in index) signups[index[k]] += 1;
    }
    for (const o of ordersRes.data ?? []) {
      const k = (o.created_at ?? "").slice(0, 7);
      if (k in index) orders[index[k]] += 1;
    }
    return { months: buckets.map((b) => b.label), signups, orders };
  },

  // ---------------- 3. Utilisateurs ----------------
  async getUsers(search?: string): Promise<Profile[]> {
    let query = supabase.from("profiles").select("*").order("created_at", { ascending: false });
    const s = search?.trim();
    if (s) query = query.or(`full_name.ilike.%${s}%,email.ilike.%${s}%`);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async updateUserRole(adminId: string, userId: string, role: UserRole): Promise<void> {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
    if (error) throw error;
    await logAction(adminId, "update_user_role", "profiles", userId, { role });
  },

  // ---------------- 4. Médecins ----------------
  async getDoctors(): Promise<DoctorRow[]> {
    const { data, error } = await supabase
      .from("doctors")
      .select("*, profile:profiles!doctors_user_id_fkey(full_name, email)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as DoctorRow[];
  },

  async setDoctorValidation(adminId: string, doctorId: string, isValidated: boolean): Promise<void> {
    const patch: TablesUpdate<"doctors"> = {
      is_validated: isValidated,
      validated_by: isValidated ? adminId : null,
      validated_at: isValidated ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("doctors").update(patch).eq("id", doctorId);
    if (error) throw error;
    await logAction(
      adminId,
      isValidated ? "validate_doctor" : "reject_doctor",
      "doctors",
      doctorId
    );
  },

  // ---------------- 5. Marketplace (produits) ----------------
  async getProducts(): Promise<MarketplaceProduct[]> {
    const { data, error } = await supabase
      .from("marketplace_products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async createProduct(
    adminId: string,
    input: {
      name: string;
      description: string | null;
      price: number;
      stock: number;
      image_url: string | null;
      is_active: boolean;
    }
  ): Promise<MarketplaceProduct> {
    const payload: TablesInsert<"marketplace_products"> = { ...input };
    const { data, error } = await supabase
      .from("marketplace_products")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    await logAction(adminId, "create_product", "marketplace_products", data.id, { name: input.name });
    return data;
  },

  async updateProduct(
    adminId: string,
    id: string,
    patch: TablesUpdate<"marketplace_products">
  ): Promise<MarketplaceProduct> {
    const { data, error } = await supabase
      .from("marketplace_products")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    await logAction(adminId, "update_product", "marketplace_products", id, patch as Json);
    return data;
  },

  // ---------------- 6. Commandes ----------------
  async getOrders(): Promise<MarketplaceOrder[]> {
    const { data, error } = await supabase
      .from("marketplace_orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async updateOrderStatus(adminId: string, id: string, status: OrderStatus): Promise<void> {
    const { error } = await supabase.from("marketplace_orders").update({ status }).eq("id", id);
    if (error) throw error;
    await logAction(adminId, "update_order_status", "marketplace_orders", id, { status });
  },

  // ---------------- 7. Communauté ----------------
  // Réutilise le service communauté existant pour la lecture (auteur joint).
  async getPosts(): Promise<CommunityPostWithAuthor[]> {
    return communityService.getPosts();
  },

  async deletePost(adminId: string, id: string): Promise<void> {
    // Supprime d'abord les dépendances (likes, commentaires) puis la publication.
    await supabase.from("community_likes").delete().eq("post_id", id);
    await supabase.from("community_comments").delete().eq("post_id", id);
    const { error } = await supabase.from("community_posts").delete().eq("id", id);
    if (error) throw error;
    await logAction(adminId, "delete_post", "community_posts", id);
  },

  // ---------------- 8. Signalements ----------------
  async getReports(): Promise<ReportRow[]> {
    const { data, error } = await supabase
      .from("user_reports")
      .select(
        "*, reporter:profiles!user_reports_reporter_id_fkey(full_name), reported:profiles!user_reports_reported_user_id_fkey(full_name)"
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as ReportRow[];
  },

  async updateReport(
    adminId: string,
    id: string,
    status: ReportStatus,
    adminNote: string | null
  ): Promise<void> {
    const { error } = await supabase
      .from("user_reports")
      .update({ status, admin_note: adminNote })
      .eq("id", id);
    if (error) throw error;
    await logAction(adminId, "update_report", "user_reports", id, { status });
  },

  // ---------------- 9. Suspensions ----------------
  async getSuspensions(): Promise<SuspensionRow[]> {
    const { data, error } = await supabase
      .from("user_suspensions")
      .select("*, user:profiles!user_suspensions_user_id_fkey(full_name, email)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as SuspensionRow[];
  },

  async suspendUser(
    adminId: string,
    userId: string,
    reason: string | null,
    endsAt: string | null
  ): Promise<void> {
    const payload: TablesInsert<"user_suspensions"> = {
      user_id: userId,
      suspended_by: adminId,
      reason,
      ends_at: endsAt,
      is_active: true,
    };
    const { data, error } = await supabase
      .from("user_suspensions")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    await logAction(adminId, "suspend_user", "user_suspensions", data.id, { user_id: userId });
    // Application réelle : bannit le compte auth (bloque la connexion).
    await invokeAdminUserAction("ban_user", userId);
  },

  // id = identifiant de la ligne user_suspensions ; userId = compte concerné (pour le déban).
  async liftSuspension(adminId: string, id: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from("user_suspensions")
      .update({ is_active: false })
      .eq("id", id);
    if (error) throw error;
    await logAction(adminId, "lift_suspension", "user_suspensions", id, { user_id: userId });
    // Lève réellement le bannissement auth.
    await invokeAdminUserAction("unban_user", userId);
  },

  // Supprime DÉFINITIVEMENT le compte d'un utilisateur (cascade côté serveur).
  async deleteUserAccount(adminId: string, userId: string): Promise<void> {
    await invokeAdminUserAction("delete_user", userId);
    await logAction(adminId, "delete_user", "profiles", userId);
  },

  // ---------------- Médecins : ajout / retrait / suppression ----------------
  // Promeut un compte EXISTANT en médecin : role='doctor' puis création de la fiche (validée).
  async addDoctor(
    adminId: string,
    targetUserId: string,
    input: {
      specialty: string;
      bio?: string | null;
      consultation_fee?: number | null;
      clinic_name?: string | null;
    }
  ): Promise<Doctor> {
    const { error: roleErr } = await supabase
      .from("profiles")
      .update({ role: "doctor" })
      .eq("id", targetUserId);
    if (roleErr) throw roleErr;
    await logAction(adminId, "update_user_role", "profiles", targetUserId, { role: "doctor" });

    const payload: TablesInsert<"doctors"> = {
      user_id: targetUserId,
      specialty: input.specialty,
      bio: input.bio ?? null,
      consultation_fee: input.consultation_fee ?? null,
      clinic_name: input.clinic_name ?? null,
      is_validated: true,
      validated_by: adminId,
      validated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("doctors").insert(payload).select("*").single();
    if (error) throw error;
    await logAction(adminId, "add_doctor", "doctors", data.id, { user_id: targetUserId });
    return data;
  },

  // Retire le statut médecin : supprime la fiche doctors et repasse le compte en 'user'.
  async demoteDoctor(adminId: string, doctor: { id: string; user_id: string }): Promise<void> {
    const { error: delErr } = await supabase.from("doctors").delete().eq("id", doctor.id);
    if (delErr) throw delErr;
    const { error: roleErr } = await supabase
      .from("profiles")
      .update({ role: "user" })
      .eq("id", doctor.user_id);
    if (roleErr) throw roleErr;
    await logAction(adminId, "demote_doctor", "doctors", doctor.id, { user_id: doctor.user_id });
  },

  // Supprime DÉFINITIVEMENT le compte complet d'un médecin (cascade côté serveur).
  async deleteDoctorAccount(adminId: string, userId: string): Promise<void> {
    await invokeAdminUserAction("delete_user", userId);
    await logAction(adminId, "delete_doctor_account", "profiles", userId);
  },

  // ---------------- 10. Paramètres ----------------
  async getSettings(): Promise<AppSettings | null> {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateSettings(
    adminId: string,
    id: string,
    patch: TablesUpdate<"app_settings">
  ): Promise<AppSettings> {
    const { data, error } = await supabase
      .from("app_settings")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    await logAction(adminId, "update_settings", "app_settings", id, patch as Json);
    return data;
  },
};
