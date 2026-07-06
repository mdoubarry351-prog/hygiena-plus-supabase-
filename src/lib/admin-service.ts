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
  Article,
  ProductReview,
  DoctorReview,
  UserRole,
  OrderStatus,
  AppointmentStatus,
  ConsultationMode,
  PractitionerType,
  DeliveryMode,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/lib/database.types";
import type { ArticleInput } from "@/lib/articles-service";

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

// Récupère TOUTES les pages d'une requête filtrée (export complet), par lots de
// EXPORT_PAGE, jusqu'à épuisement ou plafond EXPORT_CAP.
async function fetchAllPages<T>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; from < EXPORT_CAP; from += EXPORT_PAGE) {
    const { data, error } = await makeQuery(from, from + EXPORT_PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < EXPORT_PAGE) break;
  }
  return all;
}

// Constructeurs de requêtes filtrées (réutilisés par les variantes paginées et
// par l'export complet) — recherche/filtres appliqués CÔTÉ SERVEUR.
function buildUsersQuery(filters?: UsersFilter) {
  let q = supabase.from("profiles").select("*").order("created_at", { ascending: false });
  const s = filters?.search?.trim();
  if (s) q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
  if (filters?.role) q = q.eq("role", filters.role);
  return q;
}

function buildProductsQuery(filters?: ProductsFilter) {
  let q = supabase.from("marketplace_products").select("*").order("created_at", { ascending: false });
  const s = filters?.search?.trim();
  if (s) q = q.ilike("name", `%${s}%`);
  if (filters?.status === "active") q = q.eq("is_active", true);
  else if (filters?.status === "inactive") q = q.eq("is_active", false);
  return q;
}

function buildOrdersQuery(filters?: OrdersFilter) {
  let q = supabase.from("marketplace_orders").select("*").order("created_at", { ascending: false });
  const s = filters?.search?.trim();
  if (s) q = q.ilike("phone", `%${s}%`); // recherche sur le téléphone (l'id uuid n'est pas filtrable en ilike)
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.source) q = q.eq("delivery_mode", filters.source);
  return q;
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
  practitionerType: PractitionerType;
  interventionAreas: string | null;
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

// Rendez-vous pour la vue admin (lecture seule) via le RPC admin_appointments_list :
// AUCUNE donnée médicale (ni motif/reason ni notes). Champs plats renvoyés par le RPC.
export type AdminAppointmentRow = {
  id: string;
  patient_name: string | null;
  doctor_name: string | null;
  specialty: string | null;
  appointment_date: string;
  appointment_time: string;
  status: AppointmentStatus;
  consultation_mode: ConsultationMode;
  is_paid: boolean;
  amount_paid: number | null;
  created_at: string;
};

// Paiement d'abonnement enrichi (nom de l'abonné) pour la vue admin.
export type AdminSubscriptionPayment = {
  id: string;
  userName: string | null;
  amount: number;
  method: string | null;
  plan: string | null;
  paid_at: string;
  period_start: string | null;
  period_end: string | null;
};

// Synthèse abonnements & paiements (vue admin).
export type SubscriptionsSummary = {
  activeCount: number;
  expiredCount: number;
  revenuePremium: number;
  revenueConsultation: number;
  paidConsultationCount: number;
  payments: AdminSubscriptionPayment[];
};

// Statistiques du tableau de bord renvoyées par la RPC `admin_dashboard_stats`.
export type DashboardRpc = {
  ok: boolean;
  usersTotal: number;
  activeUsers: number;
  premiumCount: number;
  doctorsActive: number;
  appointmentsToday: number;
  ordersTotal: number;
  ordersPending: number;
  postsCount: number;
  reportsPending: number;
  revenueMarketplace: number;
  revenueConsultation: number;
  revenuePremium: number;
  revenueTotal: number;
};
// Avis enrichis pour la modération : nom de l'auteur + nom de la cible.
export type ProductReviewRow = ProductReview & { authorName: string | null; targetName: string | null };
export type DoctorReviewRow = DoctorReview & { authorName: string | null; targetName: string | null };

// Récap d'activité pour les fiches détaillées (admin).
export type UserActivity = {
  orders: number;
  posts: number;
  appointments: number;
  isPremium: boolean;
  createdAt: string | null;
};
export type DoctorActivity = {
  appointments: number;
  ratingAvg: number;
  ratingCount: number;
  revenue: number;
  isValidated: boolean;
};

// Filtres serveur des listes admin (tous optionnels).
export type UsersFilter = { search?: string | null; role?: UserRole | null };
export type ProductsFilter = { search?: string | null; status?: "active" | "inactive" | null };
export type OrdersFilter = { search?: string | null; status?: OrderStatus | null; source?: DeliveryMode | null };

// Plafond de sécurité pour l'export complet (toutes pages confondues).
const EXPORT_CAP = 5000;
const EXPORT_PAGE = 1000;

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

  // Stats consolidées via la RPC `admin_dashboard_stats` (9 cartes du dashboard).
  async getDashboardStatsRpc(): Promise<DashboardRpc> {
    const { data, error } = await supabase.rpc("admin_dashboard_stats");
    if (error) throw error;
    return data as unknown as DashboardRpc;
  },

  // Rendez-vous (vue admin, lecture seule) : patient + médecin joints, paginés,
  // filtrables par statut. RLS admin autorise la lecture de tous les RDV.
  // Source = RPC admin_appointments_list (guardé is_admin) : aucune donnée médicale
  // (ni motif ni notes). Filtre statut + pagination passés au RPC.
  async getAppointmentsAdmin(opts: { status?: AppointmentStatus | null; limit?: number; offset?: number }): Promise<AdminAppointmentRow[]> {
    const { data, error } = await supabase.rpc("admin_appointments_list", {
      p_status: opts.status ?? null,
      p_limit: opts.limit ?? 20,
      p_offset: opts.offset ?? 0,
    });
    if (error) throw error;
    return (data ?? []) as AdminAppointmentRow[];
  },

  // Abonnements & paiements (vue admin). État dérivé de subscription_payments :
  // « actif » = période la plus récente d'un abonné dont period_end >= aujourd'hui.
  // Paiement simulé = toujours réussi (pas de notion d'échec).
  async getSubscriptionsAdmin(limit = 50): Promise<SubscriptionsSummary> {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const [payRes, apptRes] = await Promise.all([
      supabase
        .from("subscription_payments")
        .select("id, user_id, amount, method, plan, period_start, period_end, paid_at, profile:profiles!subscription_payments_user_id_fkey(full_name)")
        .order("paid_at", { ascending: false }),
      supabase.from("appointments").select("amount_paid").eq("is_paid", true),
    ]);
    if (payRes.error) throw payRes.error;
    if (apptRes.error) throw apptRes.error;

    const rows = (payRes.data ?? []) as unknown as {
      id: string; user_id: string; amount: number; method: string | null; plan: string | null;
      period_start: string | null; period_end: string | null; paid_at: string;
      profile: { full_name: string | null } | null;
    }[];

    const revenuePremium = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
    const revenueConsultation = (apptRes.data ?? []).reduce((s, a) => s + (a.amount_paid ?? 0), 0);
    const paidConsultationCount = (apptRes.data ?? []).length;

    // Période la plus récente par abonné → actif/expiré.
    const latestByUser = new Map<string, string | null>();
    for (const r of rows) {
      const cur = latestByUser.get(r.user_id);
      if (cur === undefined || (r.period_end ?? "") > (cur ?? "")) latestByUser.set(r.user_id, r.period_end ?? null);
    }
    let activeCount = 0;
    let expiredCount = 0;
    for (const end of latestByUser.values()) {
      if (end && end >= today) activeCount += 1;
      else expiredCount += 1;
    }

    const payments: AdminSubscriptionPayment[] = rows.slice(0, limit).map((r) => ({
      id: r.id,
      userName: r.profile?.full_name ?? null,
      amount: r.amount,
      method: r.method,
      plan: r.plan,
      paid_at: r.paid_at,
      period_start: r.period_start,
      period_end: r.period_end,
    }));

    return { activeCount, expiredCount, revenuePremium, revenueConsultation, paidConsultationCount, payments };
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
  // Recherche d'utilisateurs (sélecteurs admins/suspensions). Plafonnée : sans
  // borne, la requête rapatriait TOUTE la table profiles.
  async getUsers(search?: string): Promise<Profile[]> {
    let query = supabase.from("profiles").select("*").order("created_at", { ascending: false });
    const s = search?.trim();
    if (s) query = query.or(`full_name.ilike.%${s}%,email.ilike.%${s}%`);
    const { data, error } = await query.limit(50);
    if (error) throw error;
    return data ?? [];
  },

  // Liste des administrateurs (gestion des droits admin).
  async getAdmins(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "admin")
      .order("full_name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  // Profils paginés — recherche (nom/email/téléphone) + rôle appliqués CÔTÉ SERVEUR.
  async getUsersPage(limit: number, offset: number, filters?: UsersFilter): Promise<Profile[]> {
    const { data, error } = await buildUsersQuery(filters).range(offset, offset + limit - 1);
    if (error) throw error;
    return data ?? [];
  },

  // Toutes les lignes correspondant aux filtres (pour l'export CSV complet).
  async getAllUsersFiltered(filters?: UsersFilter): Promise<Profile[]> {
    return fetchAllPages((from, to) => buildUsersQuery(filters).range(from, to));
  },

  async updateUserRole(adminId: string, userId: string, role: UserRole): Promise<void> {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
    if (error) throw error;
    await logAction(adminId, "update_user_role", "profiles", userId, { role });
  },

  // Récap d'activité d'une utilisatrice (counts en parallèle) pour la fiche détail.
  async getUserActivity(userId: string): Promise<UserActivity> {
    const [ordersRes, postsRes, apptRes, profileRes] = await Promise.all([
      supabase.from("marketplace_orders").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("community_posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("patient_id", userId),
      supabase.from("profiles").select("is_premium, created_at").eq("id", userId).maybeSingle(),
    ]);
    return {
      orders: ordersRes.count ?? 0,
      posts: postsRes.count ?? 0,
      appointments: apptRes.count ?? 0,
      isPremium: profileRes.data?.is_premium ?? false,
      createdAt: profileRes.data?.created_at ?? null,
    };
  },

  // ---------------- 4. Médecins ----------------
  async getDoctors(): Promise<DoctorRow[]> {
    const { data, error } = await supabase
      .from("doctors")
      .select("*, profile:profiles!doctors_user_id_fkey(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(200);
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

  // Tous les médecins (pour l'export complet). La recherche par NOM se fait
  // côté client sur le résultat (le nom vit sur profiles, jeu de données réduit).
  async getAllDoctors(): Promise<DoctorRow[]> {
    return fetchAllPages<DoctorRow>((from, to) =>
      supabase
        .from("doctors")
        .select("*, profile:profiles!doctors_user_id_fkey(full_name, email)")
        .order("created_at", { ascending: false })
        .range(from, to) as unknown as PromiseLike<{ data: DoctorRow[] | null; error: { message: string } | null }>
    );
  },

  // URL signée (courte durée) pour consulter un document KYC du bucket privé.
  async getKycSignedUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage.from("doctor-kyc").createSignedUrl(path, 60);
    if (error) throw error;
    if (!data?.signedUrl) throw new Error("URL signée indisponible.");
    return data.signedUrl;
  },

  // Récap d'activité d'un médecin pour la fiche détail : rendez-vous, note/avis,
  // revenus (somme des consultations payées), statut validé.
  async getDoctorActivity(doctorId: string): Promise<DoctorActivity> {
    const [apptRes, doctorRes, paidRes] = await Promise.all([
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("doctor_id", doctorId),
      supabase.from("doctors").select("rating_avg, rating_count, is_validated").eq("id", doctorId).maybeSingle(),
      supabase.from("appointments").select("amount_paid").eq("doctor_id", doctorId).eq("is_paid", true),
    ]);
    const revenue = (paidRes.data ?? []).reduce((sum, a) => sum + (a.amount_paid ?? 0), 0);
    return {
      appointments: apptRes.count ?? 0,
      ratingAvg: doctorRes.data?.rating_avg ?? 0,
      ratingCount: doctorRes.data?.rating_count ?? 0,
      revenue,
      isValidated: doctorRes.data?.is_validated ?? false,
    };
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

  // Produits paginés — recherche (nom) + statut (actif/inactif) CÔTÉ SERVEUR.
  async getProductsPage(limit: number, offset: number, filters?: ProductsFilter): Promise<MarketplaceProduct[]> {
    const { data, error } = await buildProductsQuery(filters).range(offset, offset + limit - 1);
    if (error) throw error;
    return data ?? [];
  },

  async getAllProductsFiltered(filters?: ProductsFilter): Promise<MarketplaceProduct[]> {
    return fetchAllPages((from, to) => buildProductsQuery(filters).range(from, to));
  },

  async createProduct(
    adminId: string,
    input: {
      name: string;
      description: string | null;
      price: number;
      stock: number;
      image_url: string | null;
      image_urls: string[] | null;
      category: string | null;
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

  // Commandes paginées — statut + mode (livraison/retrait) + recherche (téléphone) CÔTÉ SERVEUR.
  async getOrdersPage(limit: number, offset: number, filters?: OrdersFilter): Promise<MarketplaceOrder[]> {
    const { data, error } = await buildOrdersQuery(filters).range(offset, offset + limit - 1);
    if (error) throw error;
    return data ?? [];
  },

  async getAllOrdersFiltered(filters?: OrdersFilter): Promise<MarketplaceOrder[]> {
    return fetchAllPages((from, to) => buildOrdersQuery(filters).range(from, to));
  },

  // Compteurs de commandes par statut (pipeline de l'écran admin).
  async getOrderCounts(): Promise<Partial<Record<OrderStatus, number>>> {
    const { data, error } = await supabase.from("marketplace_orders").select("status");
    if (error) throw error;
    const out: Partial<Record<OrderStatus, number>> = {};
    for (const row of data ?? []) {
      const st = row.status as OrderStatus;
      out[st] = (out[st] ?? 0) + 1;
    }
    return out;
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

  // ---------------- 7bis. Diffusion de notifications ----------------
  // Nombre de destinataires d'un public (preview avant envoi).
  async broadcastCount(audience: string): Promise<number> {
    const { data, error } = await supabase.rpc("admin_broadcast_count", { p_audience: audience });
    if (error) throw error;
    return typeof data === "number" ? data : 0;
  },

  // Envoie une notification à tout le public choisi (une notif par destinataire).
  async sendBroadcast(adminId: string, title: string, message: string, audience: string): Promise<number> {
    const { data, error } = await supabase.rpc("admin_broadcast", {
      p_title: title,
      p_message: message,
      p_audience: audience,
    });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || "Diffusion impossible.");
    const count = data.count ?? 0;
    await logAction(adminId, "broadcast_notification", "notifications", null, { audience, count });
    return count;
  },

  // ---------------- 7ter. Modération des avis ----------------
  // Avis produits (récents d'abord) + résolution nom auteur (profiles) et
  // nom de la cible (marketplace_products), via requêtes séparées.
  async getProductReviewsAdmin(limit: number, offset: number): Promise<ProductReviewRow[]> {
    const { data, error } = await supabase
      .from("product_reviews")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    const rows = data ?? [];
    if (!rows.length) return [];

    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const productIds = [...new Set(rows.map((r) => r.product_id))];
    const [profilesRes, productsRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name").in("id", userIds),
      supabase.from("marketplace_products").select("id, name").in("id", productIds),
    ]);
    const authorMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name]));
    const productMap = new Map((productsRes.data ?? []).map((p) => [p.id, p.name]));
    return rows.map((r) => ({
      ...r,
      authorName: authorMap.get(r.user_id) ?? null,
      targetName: productMap.get(r.product_id) ?? null,
    }));
  },

  // Avis médecins (récents d'abord) + nom auteur (profiles via patient_id) et
  // nom du médecin (doctors.user_id → profiles).
  async getDoctorReviewsAdmin(limit: number, offset: number): Promise<DoctorReviewRow[]> {
    const { data, error } = await supabase
      .from("doctor_reviews")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    const rows = data ?? [];
    if (!rows.length) return [];

    const doctorIds = [...new Set(rows.map((r) => r.doctor_id))];
    const { data: doctors } = await supabase.from("doctors").select("id, user_id").in("id", doctorIds);
    const doctorUserMap = new Map((doctors ?? []).map((d) => [d.id, d.user_id]));

    // Profils nécessaires : patients (auteurs) + comptes des médecins (cibles).
    const profileIds = [
      ...new Set([
        ...rows.map((r) => r.patient_id),
        ...(doctors ?? []).map((d) => d.user_id),
      ]),
    ];
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", profileIds);
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    return rows.map((r) => {
      const docUserId = doctorUserMap.get(r.doctor_id);
      return {
        ...r,
        authorName: nameMap.get(r.patient_id) ?? null,
        targetName: docUserId ? nameMap.get(docUserId) ?? null : null,
      };
    });
  },

  async deleteProductReview(adminId: string, id: string): Promise<void> {
    const { error } = await supabase.from("product_reviews").delete().eq("id", id);
    if (error) throw error;
    await logAction(adminId, "delete_review", "product_reviews", id);
  },

  async deleteDoctorReview(adminId: string, id: string): Promise<void> {
    const { error } = await supabase.from("doctor_reviews").delete().eq("id", id);
    if (error) throw error;
    await logAction(adminId, "delete_review", "doctor_reviews", id);
  },

  // ---------------- 7c. Articles (bibliothèque de contenu) ----------------
  // Admin : voit TOUS les articles (publiés + brouillons).
  async getAllArticles(): Promise<Article[]> {
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  },

  async createArticle(adminId: string, input: ArticleInput): Promise<Article> {
    const payload: TablesInsert<"articles"> = {
      title: input.title,
      category: input.category,
      excerpt: input.excerpt,
      content: input.content,
      cover_image_url: input.coverImageUrl,
      is_published: input.isPublished,
      created_by: adminId,
    };
    const { data, error } = await supabase.from("articles").insert(payload).select("*").single();
    if (error) throw error;
    await logAction(adminId, "create_article", "articles", data.id, { title: input.title });
    return data;
  },

  async updateArticle(adminId: string, id: string, input: ArticleInput): Promise<Article> {
    const patch: TablesUpdate<"articles"> = {
      title: input.title,
      category: input.category,
      excerpt: input.excerpt,
      content: input.content,
      cover_image_url: input.coverImageUrl,
      is_published: input.isPublished,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("articles").update(patch).eq("id", id).select("*").single();
    if (error) throw error;
    await logAction(adminId, "update_article", "articles", id, { title: input.title });
    return data;
  },

  async setArticlePublished(adminId: string, id: string, published: boolean): Promise<void> {
    const { error } = await supabase
      .from("articles")
      .update({ is_published: published, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await logAction(adminId, "publish_article", "articles", id, { is_published: published });
  },

  async deleteArticle(adminId: string, id: string): Promise<void> {
    const { error } = await supabase.from("articles").delete().eq("id", id);
    if (error) throw error;
    await logAction(adminId, "delete_article", "articles", id);
  },

  // ---------------- 8. Signalements ----------------
  async getReports(): Promise<ReportRow[]> {
    const { data, error } = await supabase
      .from("user_reports")
      .select(
        "*, reporter:profiles!user_reports_reporter_id_fkey(full_name), reported:profiles!user_reports_reported_user_id_fkey(full_name)"
      )
      .order("created_at", { ascending: false })
      .limit(200);
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

  // Fixe le type de praticien + domaines d'intervention d'une fiche (par user_id).
  // Filet de sécurité après createDoctor (l'admin peut écrire `doctors` : RLS is_admin).
  async setDoctorType(userId: string, practitionerType: PractitionerType, interventionAreas: string | null): Promise<void> {
    const patch: TablesUpdate<"doctors"> = { practitioner_type: practitionerType, intervention_areas: interventionAreas };
    const { error } = await supabase.from("doctors").update(patch).eq("user_id", userId);
    if (error) throw error;
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
