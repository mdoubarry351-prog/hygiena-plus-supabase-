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
  StoreSettings,
  BannedWord,
  UserRole,
  OrderStatus,
  Json,
  Tables,
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

// Création d'un médecin de zéro (compte de connexion inclus) via Edge Function.
export type CreateDoctorInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  specialty: string;
  yearsExperience: number;
  consultationFeeGNF: number;
  bio: string | null;
  avatarUrl: string | null;
  isValidated: boolean;
};
export type CreateDoctorResult = {
  success: boolean;
  user_id: string;
  temp_password: string;
  phone: string | null;
  email: string | null;
};
export type ReportRow = UserReport & {
  reporter: Pick<Profile, "full_name"> | null;
  reported: Pick<Profile, "full_name"> | null;
};
export type SuspensionRow = UserSuspension & {
  user: Pick<Profile, "full_name" | "email"> | null;
};
export type AuditLogRow = Tables<"admin_logs"> & { adminName: string | null };

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
  appointments: number[];
};

export type RevenueStats = {
  marketplaceRevenue: number;
  consultationRevenue: number;
  totalRevenue: number;
  premiumCount: number;
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
  // Créations par mois sur les 6 derniers mois (inscriptions + commandes + RDV).
  async getMonthlySeries(): Promise<MonthlySeries> {
    const [profsRes, ordersRes, apptRes] = await Promise.all([
      supabase.from("profiles").select("created_at"),
      supabase.from("marketplace_orders").select("created_at"),
      supabase.from("appointments").select("created_at"),
    ]);
    if (profsRes.error) throw profsRes.error;
    if (ordersRes.error) throw ordersRes.error;
    if (apptRes.error) throw apptRes.error;

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
    const appointments = new Array(6).fill(0);
    for (const p of profsRes.data ?? []) {
      const k = (p.created_at ?? "").slice(0, 7);
      if (k in index) signups[index[k]] += 1;
    }
    for (const o of ordersRes.data ?? []) {
      const k = (o.created_at ?? "").slice(0, 7);
      if (k in index) orders[index[k]] += 1;
    }
    for (const a of apptRes.data ?? []) {
      const k = (a.created_at ?? "").slice(0, 7);
      if (k in index) appointments[index[k]] += 1;
    }
    return { months: buckets.map((b) => b.label), signups, orders, appointments };
  },

  // Revenus (marketplace livré + consultations payées) + nb d'abonnées premium.
  async getRevenueStats(): Promise<RevenueStats> {
    const [ordersRes, apptRes, premiumRes] = await Promise.all([
      supabase.from("marketplace_orders").select("total_amount").eq("status", "completed"),
      supabase.from("appointments").select("amount_paid").eq("is_paid", true),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_premium", true),
    ]);
    if (ordersRes.error) throw ordersRes.error;
    if (apptRes.error) throw apptRes.error;
    if (premiumRes.error) throw premiumRes.error;

    const marketplaceRevenue = (ordersRes.data ?? []).reduce((s, o) => s + (o.total_amount ?? 0), 0);
    const consultationRevenue = (apptRes.data ?? []).reduce((s, a) => s + (a.amount_paid ?? 0), 0);
    return {
      marketplaceRevenue,
      consultationRevenue,
      totalRevenue: marketplaceRevenue + consultationRevenue,
      premiumCount: premiumRes.count ?? 0,
    };
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

  // Profils paginés (.range) — recherche/filtres faits côté client sur le chargé.
  async getUsersPage(limit: number, offset: number): Promise<Profile[]> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
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

  async getDoctorsPage(limit: number, offset: number): Promise<DoctorRow[]> {
    const { data, error } = await supabase
      .from("doctors")
      .select("*, profile:profiles!doctors_user_id_fkey(full_name, email)")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
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

  async getProductsPage(limit: number, offset: number): Promise<MarketplaceProduct[]> {
    const { data, error } = await supabase
      .from("marketplace_products")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
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

  async getOrdersPage(limit: number, offset: number): Promise<MarketplaceOrder[]> {
    const { data, error } = await supabase
      .from("marketplace_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
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

  // ---------------- 7b. Mots interdits (modération) ----------------
  // Les triggers SQL bloquent l'insertion de tout contenu contenant un mot
  // ACTIF. Ici : gestion de la liste (lecture/ajout/activation/suppression).
  async getBannedWords(): Promise<BannedWord[]> {
    const { data, error } = await supabase
      .from("banned_words")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async addBannedWord(adminId: string, word: string, severity: number): Promise<BannedWord> {
    const payload: TablesInsert<"banned_words"> = {
      word: word.trim().toLowerCase(),
      severity,
    };
    const { data, error } = await supabase
      .from("banned_words")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    await logAction(adminId, "add_banned_word", "banned_words", data.id, { word: data.word, severity });
    return data;
  },

  async setBannedWordActive(adminId: string, id: string, active: boolean): Promise<void> {
    const { error } = await supabase.from("banned_words").update({ is_active: active }).eq("id", id);
    if (error) throw error;
    await logAction(adminId, "toggle_banned_word", "banned_words", id, { is_active: active });
  },

  async deleteBannedWord(adminId: string, id: string): Promise<void> {
    const { error } = await supabase.from("banned_words").delete().eq("id", id);
    if (error) throw error;
    await logAction(adminId, "delete_banned_word", "banned_words", id);
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
  // Crée un médecin de ZÉRO (compte de connexion inclus) via l'Edge Function
  // admin-user-actions (action create_doctor). Elle crée le compte auth,
  // pose role='doctor', insère la fiche doctors, journalise et renvoie les
  // identifiants de connexion (dont le mot de passe temporaire).
  async createDoctor(input: CreateDoctorInput): Promise<CreateDoctorResult> {
    const { data, error } = await supabase.functions.invoke("admin-user-actions", {
      body: { action: "create_doctor", ...input },
    });
    if (error) {
      let message = error.message || "Création du médecin échouée";
      try {
        const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
        const body = ctx?.json ? ((await ctx.json()) as { error?: string }) : null;
        if (body?.error) message = body.error;
      } catch {
        // garde le message par défaut
      }
      throw new Error(message);
    }
    const result = data as (CreateDoctorResult & { error?: string }) | null;
    if (!result || result.error) throw new Error(result?.error || "Création du médecin échouée");
    return result;
  },

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

  // ---------------- 11b. Paramètres de la boutique ----------------
  async getStoreSettings(): Promise<StoreSettings | null> {
    const { data, error } = await supabase
      .from("store_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateStoreSettings(
    adminId: string,
    id: string,
    patch: TablesUpdate<"store_settings">
  ): Promise<StoreSettings> {
    const payload: TablesUpdate<"store_settings"> = {
      ...patch,
      updated_by: adminId,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("store_settings")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    await logAction(adminId, "update_store_settings", "store_settings", id, patch as Json);
    return data;
  },

  // ---------------- 11. Journal d'audit ----------------
  // Lit les dernières actions admin (admin_logs) + résout le nom de l'admin
  // via une requête profiles séparée (pas d'embed FK fragile).
  async getAuditLogs(limit = 100): Promise<AuditLogRow[]> {
    const { data, error } = await supabase
      .from("admin_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    const logs = data ?? [];

    const ids = [...new Set(logs.map((l) => l.admin_id).filter((x): x is string => !!x))];
    const nameById: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      for (const p of profs ?? []) nameById[p.id] = p.full_name ?? "";
    }

    return logs.map((l) => ({ ...l, adminName: l.admin_id ? nameById[l.admin_id] ?? null : null }));
  },
};
