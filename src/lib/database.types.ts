// =====================================================
// Hygiena+ — database.types.ts
// Généré à partir du schéma SQL réel (14 tables).
// Compatible @supabase/supabase-js : createClient<Database>(...)
// Mappage SQL -> TS : uuid/text/time/date/timestamptz -> string,
// numeric -> number, integer -> number, boolean -> boolean,
// jsonb -> Json, text[] -> string[].
// =====================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ----- Enums PostgreSQL -----
export type UserRole = "user" | "doctor" | "admin";
export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed";
export type DeliveryMode = "delivery" | "pickup";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "delivering"
  | "completed"
  | "cancelled";

export type Database = {
  public: {
    Tables: {
      // =================================================
      // 1. profiles
      // =================================================
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          avatar_url: string | null;
          role: UserRole;
          is_premium: boolean;
          date_of_birth: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          is_premium?: boolean;
          date_of_birth?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          is_premium?: boolean;
          date_of_birth?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };

      // =================================================
      // 2. menstrual_cycles
      // =================================================
      menstrual_cycles: {
        Row: {
          id: string;
          user_id: string;
          period_start: string;
          period_end: string | null;
          ovulation_date: string | null;
          cycle_length: number | null;
          symptoms: string[] | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          period_start: string;
          period_end?: string | null;
          ovulation_date?: string | null;
          cycle_length?: number | null;
          symptoms?: string[] | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          period_start?: string;
          period_end?: string | null;
          ovulation_date?: string | null;
          cycle_length?: number | null;
          symptoms?: string[] | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menstrual_cycles_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };

      // =================================================
      // 3. doctors
      // =================================================
      doctors: {
        Row: {
          id: string;
          user_id: string;
          specialty: string;
          bio: string | null;
          license_number: string | null;
          availability: Json;
          consultation_fee: number | null;
          clinic_name: string | null;
          years_experience: number;
          rating_avg: number;
          rating_count: number;
          is_validated: boolean;
          validated_by: string | null;
          validated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          specialty: string;
          bio?: string | null;
          license_number?: string | null;
          availability?: Json;
          consultation_fee?: number | null;
          clinic_name?: string | null;
          years_experience?: number;
          rating_avg?: number;
          rating_count?: number;
          is_validated?: boolean;
          validated_by?: string | null;
          validated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          specialty?: string;
          bio?: string | null;
          license_number?: string | null;
          availability?: Json;
          consultation_fee?: number | null;
          clinic_name?: string | null;
          years_experience?: number;
          rating_avg?: number;
          rating_count?: number;
          is_validated?: boolean;
          validated_by?: string | null;
          validated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "doctors_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "doctors_validated_by_fkey";
            columns: ["validated_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };

      // =================================================
      // 4. appointments
      // =================================================
      appointments: {
        Row: {
          id: string;
          patient_id: string;
          doctor_id: string;
          appointment_date: string;
          appointment_time: string;
          status: AppointmentStatus;
          reason: string | null;
          notes: string | null;
          is_paid: boolean;
          amount_paid: number | null;
          paid_at: string | null;
          receipt_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          doctor_id: string;
          appointment_date: string;
          appointment_time: string;
          status?: AppointmentStatus;
          reason?: string | null;
          notes?: string | null;
          is_paid?: boolean;
          amount_paid?: number | null;
          paid_at?: string | null;
          receipt_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          doctor_id?: string;
          appointment_date?: string;
          appointment_time?: string;
          status?: AppointmentStatus;
          reason?: string | null;
          notes?: string | null;
          is_paid?: boolean;
          amount_paid?: number | null;
          paid_at?: string | null;
          receipt_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey";
            columns: ["patient_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey";
            columns: ["doctor_id"];
            referencedRelation: "doctors";
            referencedColumns: ["id"];
          }
        ];
      };

      // =================================================
      // 4b. doctor_messages (messagerie premium patient ↔ médecin)
      // =================================================
      doctor_messages: {
        Row: {
          id: string;
          patient_id: string;
          doctor_id: string;
          sender_role: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          doctor_id: string;
          sender_role: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          doctor_id?: string;
          sender_role?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "doctor_messages_patient_id_fkey";
            columns: ["patient_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "doctor_messages_doctor_id_fkey";
            columns: ["doctor_id"];
            referencedRelation: "doctors";
            referencedColumns: ["id"];
          }
        ];
      };

      // =================================================
      // 5. marketplace_products
      // =================================================
      marketplace_products: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          price: number;
          stock: number;
          image_url: string | null;
          is_active: boolean;
          rating_avg: number;
          rating_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          price?: number;
          stock?: number;
          image_url?: string | null;
          is_active?: boolean;
          rating_avg?: number;
          rating_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          price?: number;
          stock?: number;
          image_url?: string | null;
          is_active?: boolean;
          rating_avg?: number;
          rating_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // =================================================
      // product_reviews
      // =================================================
      product_reviews: {
        Row: {
          id: string;
          product_id: string;
          user_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          user_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          user_id?: string;
          rating?: number;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "marketplace_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_reviews_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };

      // =================================================
      // doctor_reviews
      // =================================================
      doctor_reviews: {
        Row: {
          id: string;
          doctor_id: string;
          patient_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          doctor_id: string;
          patient_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          doctor_id?: string;
          patient_id?: string;
          rating?: number;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "doctor_reviews_doctor_id_fkey";
            columns: ["doctor_id"];
            referencedRelation: "doctors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "doctor_reviews_patient_id_fkey";
            columns: ["patient_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };

      // =================================================
      // 6. marketplace_orders
      // =================================================
      marketplace_orders: {
        Row: {
          id: string;
          user_id: string;
          phone: string;
          neighborhood: string | null;
          delivery_mode: DeliveryMode;
          instructions: string | null;
          total_amount: number;
          status: OrderStatus;
          items: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          phone: string;
          neighborhood?: string | null;
          delivery_mode?: DeliveryMode;
          instructions?: string | null;
          total_amount?: number;
          status?: OrderStatus;
          items?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          phone?: string;
          neighborhood?: string | null;
          delivery_mode?: DeliveryMode;
          instructions?: string | null;
          total_amount?: number;
          status?: OrderStatus;
          items?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };

      // =================================================
      // 7. community_posts
      // =================================================
      community_posts: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          is_anonymous: boolean;
          category: string | null;
          likes_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          is_anonymous?: boolean;
          category?: string | null;
          likes_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content?: string;
          is_anonymous?: boolean;
          category?: string | null;
          likes_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_posts_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };

      // =================================================
      // 8. community_comments
      // =================================================
      community_comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          content: string;
          is_anonymous: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          content: string;
          is_anonymous?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          user_id?: string;
          content?: string;
          is_anonymous?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_comments_post_id_fkey";
            columns: ["post_id"];
            referencedRelation: "community_posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_comments_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };

      // =================================================
      // 9. community_likes
      // =================================================
      community_likes: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_likes_post_id_fkey";
            columns: ["post_id"];
            referencedRelation: "community_posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_likes_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };

      // =================================================
      // 10. app_settings
      // =================================================
      app_settings: {
        Row: {
          id: string;
          marketplace_enabled: boolean;
          doctors_enabled: boolean;
          premium_enabled: boolean;
          appointments_enabled: boolean;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          marketplace_enabled?: boolean;
          doctors_enabled?: boolean;
          premium_enabled?: boolean;
          appointments_enabled?: boolean;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          marketplace_enabled?: boolean;
          doctors_enabled?: boolean;
          premium_enabled?: boolean;
          appointments_enabled?: boolean;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey";
            columns: ["updated_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };

      // =================================================
      // 11. admin_logs
      // =================================================
      admin_logs: {
        Row: {
          id: string;
          admin_id: string | null;
          action: string;
          target_table: string | null;
          target_id: string | null;
          details: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id?: string | null;
          action: string;
          target_table?: string | null;
          target_id?: string | null;
          details?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_id?: string | null;
          action?: string;
          target_table?: string | null;
          target_id?: string | null;
          details?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_logs_admin_id_fkey";
            columns: ["admin_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };

      // =================================================
      // 11b. store_settings (paramètres de la boutique — ligne unique)
      // =================================================
      store_settings: {
        Row: {
          id: string;
          whatsapp_enabled: boolean;
          whatsapp_number: string | null;
          cod_enabled: boolean;
          cod_max_amount: number;
          cod_min_account_age_days: number;
          cod_zones: string[] | null;
          default_delivery_fee: number;
          free_delivery_threshold: number | null;
          delivery_zones: Json | null;
          announcement: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          whatsapp_enabled?: boolean;
          whatsapp_number?: string | null;
          cod_enabled?: boolean;
          cod_max_amount?: number;
          cod_min_account_age_days?: number;
          cod_zones?: string[] | null;
          default_delivery_fee?: number;
          free_delivery_threshold?: number | null;
          delivery_zones?: Json | null;
          announcement?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          whatsapp_enabled?: boolean;
          whatsapp_number?: string | null;
          cod_enabled?: boolean;
          cod_max_amount?: number;
          cod_min_account_age_days?: number;
          cod_zones?: string[] | null;
          default_delivery_fee?: number;
          free_delivery_threshold?: number | null;
          delivery_zones?: Json | null;
          announcement?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_settings_updated_by_fkey";
            columns: ["updated_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };

      // =================================================
      // 12. user_reports
      // =================================================
      user_reports: {
        Row: {
          id: string;
          reporter_id: string | null;
          reported_user_id: string | null;
          post_id: string | null;
          reason: string;
          status: string;
          admin_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reporter_id?: string | null;
          reported_user_id?: string | null;
          post_id?: string | null;
          reason: string;
          status?: string;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string | null;
          reported_user_id?: string | null;
          post_id?: string | null;
          reason?: string;
          status?: string;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_reports_reported_user_id_fkey";
            columns: ["reported_user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_reports_post_id_fkey";
            columns: ["post_id"];
            referencedRelation: "community_posts";
            referencedColumns: ["id"];
          }
        ];
      };

      // =================================================
      // 13. user_suspensions
      // =================================================
      user_suspensions: {
        Row: {
          id: string;
          user_id: string;
          suspended_by: string | null;
          reason: string | null;
          starts_at: string;
          ends_at: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          suspended_by?: string | null;
          reason?: string | null;
          starts_at?: string;
          ends_at?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          suspended_by?: string | null;
          reason?: string | null;
          starts_at?: string;
          ends_at?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_suspensions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_suspensions_suspended_by_fkey";
            columns: ["suspended_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };

      // =================================================
      // 14. notifications
      // =================================================
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: string | null;
          data: Json | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          type?: string | null;
          data?: Json | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string;
          type?: string | null;
          data?: Json | null;
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      // Vue sécurisée des publications : user_id renvoyé NULL pour un post
      // anonyme d'une autre personne (ne jamais exposer l'identité réelle).
      community_posts_safe: {
        Row: {
          id: string;
          user_id: string | null;
          content: string;
          is_anonymous: boolean;
          category: string | null;
          likes_count: number;
          created_at: string;
          updated_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      // Créneaux OCCUPÉS d'un médecin (sans aucune info patiente).
      doctor_booked_slots: {
        Args: { p_doctor: string; p_from: string; p_to: string };
        Returns: { appointment_date: string; appointment_time: string }[];
      };
    };
    Enums: {
      user_role: UserRole;
      appointment_status: AppointmentStatus;
      delivery_mode: DeliveryMode;
      order_status: OrderStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

// =====================================================
// Helpers de typage (raccourcis pratiques)
// =====================================================
type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];

// Alias par entité (utilisables partout dans l'app)
export type Profile = Tables<"profiles">;
export type MenstrualCycle = Tables<"menstrual_cycles">;
export type Doctor = Tables<"doctors">;
export type Appointment = Tables<"appointments">;
export type DoctorMessage = Tables<"doctor_messages">;
export type MarketplaceProduct = Tables<"marketplace_products">;
export type MarketplaceOrder = Tables<"marketplace_orders">;
export type ProductReview = Tables<"product_reviews">;
export type DoctorReview = Tables<"doctor_reviews">;
export type CommunityPost = Tables<"community_posts">;
export type CommunityPostSafe = Database["public"]["Views"]["community_posts_safe"]["Row"];
export type CommunityComment = Tables<"community_comments">;
export type CommunityLike = Tables<"community_likes">;
export type AppSettings = Tables<"app_settings">;
export type StoreSettings = Tables<"store_settings">;
export type AdminLog = Tables<"admin_logs">;
export type UserReport = Tables<"user_reports">;
export type UserSuspension = Tables<"user_suspensions">;
export type Notification = Tables<"notifications">;
