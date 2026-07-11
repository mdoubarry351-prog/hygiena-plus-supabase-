-- =====================================================================
-- Hygiena+ — Snapshot complet du schéma Supabase (schema `public`)
-- Projet : iideovxddiytiqxdlwlt (us-east-2)
-- Généré le 2026-07-06 par introspection lecture seule de la base live.
--
-- Contenu : 4 types ENUM, 29 tables, 2 vues, 43 fonctions, 37 triggers,
--           96 politiques RLS, 84 index.
--
-- But : archive/sauvegarde versionnée de la structure de la base.
-- Ce fichier documente l'état du schéma ; il n'est pas destiné à être
-- rejoué tel quel sur la base de production existante (extensions,
-- schéma auth/storage gérés par Supabase non inclus).
-- =====================================================================

-- Extensions attendues (gérées par Supabase) :
-- create extension if not exists "uuid-ossp";
-- create extension if not exists "pgcrypto";
-- (http/pg_net utilisées par send_expo_push)

-- =====================================================================
-- 1) TYPES ENUM
-- =====================================================================

CREATE TYPE public.appointment_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
CREATE TYPE public.delivery_mode AS ENUM ('delivery', 'pickup');
CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'preparing', 'delivering', 'completed', 'cancelled');
CREATE TYPE public.user_role AS ENUM ('user', 'doctor', 'admin');

-- =====================================================================
-- 2) TABLES (colonnes + contraintes)
-- =====================================================================

CREATE TABLE public.admin_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  admin_id uuid,
  action text NOT NULL,
  target_table text,
  target_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_logs_pkey PRIMARY KEY (id),
  CONSTRAINT admin_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  marketplace_enabled boolean NOT NULL DEFAULT true,
  doctors_enabled boolean NOT NULL DEFAULT true,
  appointments_enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  messaging_enabled boolean NOT NULL DEFAULT true,
  cycle_enabled boolean NOT NULL DEFAULT true,
  community_enabled boolean NOT NULL DEFAULT true,
  CONSTRAINT app_settings_pkey PRIMARY KEY (id),
  CONSTRAINT app_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id)
);

CREATE TABLE public.appointments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  appointment_date date NOT NULL,
  appointment_time time without time zone NOT NULL,
  status appointment_status NOT NULL DEFAULT 'pending'::appointment_status,
  reason text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_paid boolean NOT NULL DEFAULT false,
  amount_paid numeric,
  paid_at timestamp with time zone,
  receipt_number text,
  consultation_mode text NOT NULL DEFAULT 'physical'::text,
  CONSTRAINT appointments_pkey PRIMARY KEY (id),
  CONSTRAINT appointments_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT appointments_consultation_mode_check CHECK ((consultation_mode = ANY (ARRAY['remote'::text, 'physical'::text])))
);

CREATE TABLE public.banned_words (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  word text NOT NULL,
  severity integer NOT NULL DEFAULT 2,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT banned_words_word_key UNIQUE (word),
  CONSTRAINT banned_words_pkey PRIMARY KEY (id),
  CONSTRAINT banned_words_severity_check CHECK (((severity >= 1) AND (severity <= 3)))
);

CREATE TABLE public.comment_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT comment_likes_comment_id_user_id_key UNIQUE (comment_id, user_id),
  CONSTRAINT comment_likes_pkey PRIMARY KEY (id),
  CONSTRAINT comment_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES community_comments(id) ON DELETE CASCADE,
  CONSTRAINT comment_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.community_comments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  parent_comment_id uuid,
  likes_count integer NOT NULL DEFAULT 0,
  CONSTRAINT community_comments_pkey PRIMARY KEY (id),
  CONSTRAINT community_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES community_comments(id) ON DELETE CASCADE,
  CONSTRAINT community_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  CONSTRAINT community_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.community_likes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT community_likes_post_id_user_id_key UNIQUE (post_id, user_id),
  CONSTRAINT community_likes_pkey PRIMARY KEY (id),
  CONSTRAINT community_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  CONSTRAINT community_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.community_posts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  category text,
  image_url text,
  comments_count integer NOT NULL DEFAULT 0,
  image_urls text[],
  CONSTRAINT community_posts_pkey PRIMARY KEY (id),
  CONSTRAINT community_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.doctor_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  sender_role text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  read_at timestamp with time zone,
  CONSTRAINT doctor_messages_pkey PRIMARY KEY (id),
  CONSTRAINT doctor_messages_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  CONSTRAINT doctor_messages_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT doctor_messages_sender_role_check CHECK ((sender_role = ANY (ARRAY['patient'::text, 'doctor'::text])))
);

CREATE TABLE public.doctor_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  rating integer NOT NULL,
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT doctor_reviews_doctor_id_patient_id_key UNIQUE (doctor_id, patient_id),
  CONSTRAINT doctor_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT doctor_reviews_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  CONSTRAINT doctor_reviews_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT doctor_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

CREATE TABLE public.doctors (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  specialty text NOT NULL,
  bio text,
  license_number text,
  availability jsonb NOT NULL DEFAULT '{}'::jsonb,
  consultation_fee numeric(10,2) DEFAULT 0,
  is_validated boolean NOT NULL DEFAULT false,
  validated_by uuid,
  validated_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  clinic_name text,
  years_experience integer,
  rating_avg numeric NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  license_document_url text,
  practitioner_type text NOT NULL DEFAULT 'gynecology'::text,
  intervention_areas text,
  CONSTRAINT doctors_user_id_key UNIQUE (user_id),
  CONSTRAINT doctors_pkey PRIMARY KEY (id),
  CONSTRAINT doctors_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT doctors_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES profiles(id),
  CONSTRAINT doctors_practitioner_type_check CHECK ((practitioner_type = ANY (ARRAY['gynecology'::text, 'therapy'::text])))
);

CREATE TABLE public.health_profiles (
  user_id uuid NOT NULL,
  height_cm integer,
  weight_kg numeric,
  blood_group text,
  allergies text,
  treatments text,
  health_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT health_profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT health_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT health_profiles_blood_group_check CHECK (((blood_group IS NULL) OR (blood_group = ANY (ARRAY['A+'::text, 'A-'::text, 'B+'::text, 'B-'::text, 'AB+'::text, 'AB-'::text, 'O+'::text, 'O-'::text])))),
  CONSTRAINT health_profiles_height_cm_check CHECK (((height_cm IS NULL) OR ((height_cm > 0) AND (height_cm < 300)))),
  CONSTRAINT health_profiles_weight_kg_check CHECK (((weight_kg IS NULL) OR ((weight_kg > (0)::numeric) AND (weight_kg < (500)::numeric))))
);

CREATE TABLE public.legal_consents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document text NOT NULL,
  version text NOT NULL,
  accepted_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT legal_consents_pkey PRIMARY KEY (id),
  CONSTRAINT legal_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT legal_consents_document_check CHECK ((document = ANY (ARRAY['terms'::text, 'privacy'::text])))
);

CREATE TABLE public.marketplace_orders (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  phone text NOT NULL,
  neighborhood text,
  delivery_mode delivery_mode NOT NULL DEFAULT 'delivery'::delivery_mode,
  instructions text,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'pending'::order_status,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  payment_method text,
  payment_phone text,
  is_paid boolean NOT NULL DEFAULT false,
  paid_at timestamp with time zone,
  CONSTRAINT marketplace_orders_pkey PRIMARY KEY (id),
  CONSTRAINT marketplace_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.marketplace_products (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  rating_avg numeric NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  category text,
  image_urls text[],
  CONSTRAINT marketplace_products_pkey PRIMARY KEY (id)
);

CREATE TABLE public.menstrual_cycles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date,
  ovulation_date date,
  cycle_length integer,
  symptoms text[],
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  flow text,
  mood text,
  pain integer,
  CONSTRAINT menstrual_cycles_pkey PRIMARY KEY (id),
  CONSTRAINT menstrual_cycles_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT menstrual_cycles_pain_check CHECK (((pain IS NULL) OR ((pain >= 0) AND (pain <= 10))))
);

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'general'::text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  data jsonb,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.order_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  status order_status NOT NULL,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT order_events_pkey PRIMARY KEY (id),
  CONSTRAINT order_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES marketplace_orders(id) ON DELETE CASCADE
);

CREATE TABLE public.payment_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  reference text NOT NULL,
  status text NOT NULL,
  amount numeric NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  raw jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_events_provider_reference_key UNIQUE (provider, reference),
  CONSTRAINT payment_events_pkey PRIMARY KEY (id),
  CONSTRAINT payment_events_provider_check CHECK ((provider = ANY (ARRAY['orange_money'::text, 'mtn_momo'::text]))),
  CONSTRAINT payment_events_target_type_check CHECK ((target_type = 'order'::text))
);

CREATE TABLE public.post_bookmarks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT post_bookmarks_user_id_post_id_key UNIQUE (user_id, post_id),
  CONSTRAINT post_bookmarks_pkey PRIMARY KEY (id),
  CONSTRAINT post_bookmarks_post_id_fkey FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  CONSTRAINT post_bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.product_favorites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_favorites_user_id_product_id_key UNIQUE (user_id, product_id),
  CONSTRAINT product_favorites_pkey PRIMARY KEY (id),
  CONSTRAINT product_favorites_product_id_fkey FOREIGN KEY (product_id) REFERENCES marketplace_products(id) ON DELETE CASCADE,
  CONSTRAINT product_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.product_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rating integer NOT NULL,
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_reviews_product_id_user_id_key UNIQUE (product_id, user_id),
  CONSTRAINT product_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT product_reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES marketplace_products(id) ON DELETE CASCADE,
  CONSTRAINT product_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT product_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  role user_role NOT NULL DEFAULT 'user'::user_role,
  date_of_birth date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  first_name text,
  last_name text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  community_rules_accepted boolean NOT NULL DEFAULT false,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.push_tokens (
  user_id uuid NOT NULL,
  token text NOT NULL,
  platform text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT push_tokens_pkey PRIMARY KEY (user_id, token),
  CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.store_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  whatsapp_number text,
  cod_enabled boolean NOT NULL DEFAULT false,
  cod_max_amount numeric NOT NULL DEFAULT 150000,
  cod_min_account_age_days integer NOT NULL DEFAULT 1,
  cod_zones text[] NOT NULL DEFAULT '{}'::text[],
  default_delivery_fee numeric NOT NULL DEFAULT 15000,
  free_delivery_threshold numeric,
  delivery_zones jsonb,
  announcement text,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT store_settings_pkey PRIMARY KEY (id),
  CONSTRAINT store_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE public.user_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_blocks_blocker_id_blocked_id_key UNIQUE (blocker_id, blocked_id),
  CONSTRAINT user_blocks_pkey PRIMARY KEY (id),
  CONSTRAINT user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT user_blocks_check CHECK ((blocker_id <> blocked_id))
);

CREATE TABLE public.user_follows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  followed_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_follows_unique UNIQUE (follower_id, followed_id),
  CONSTRAINT user_follows_pkey PRIMARY KEY (id),
  CONSTRAINT user_follows_followed_id_fkey FOREIGN KEY (followed_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT user_follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT user_follows_not_self CHECK ((follower_id <> followed_id))
);

CREATE TABLE public.user_reports (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  reporter_id uuid,
  reported_user_id uuid,
  post_id uuid,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  admin_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_reports_pkey PRIMARY KEY (id),
  CONSTRAINT user_reports_post_id_fkey FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE SET NULL,
  CONSTRAINT user_reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT user_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE public.user_suspensions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  suspended_by uuid,
  reason text,
  starts_at timestamp with time zone NOT NULL DEFAULT now(),
  ends_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_suspensions_pkey PRIMARY KEY (id),
  CONSTRAINT user_suspensions_suspended_by_fkey FOREIGN KEY (suspended_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT user_suspensions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- =====================================================================
-- 3) VUES
-- =====================================================================

CREATE OR REPLACE VIEW public.community_comments_safe AS
 SELECT id,
    post_id,
    content,
    is_anonymous,
    created_at,
    updated_at,
    parent_comment_id,
    likes_count,
        CASE
            WHEN is_anonymous = true AND user_id <> auth.uid() AND NOT is_admin() THEN NULL::uuid
            ELSE user_id
        END AS user_id,
    user_id = auth.uid() AS is_mine
   FROM community_comments;

CREATE OR REPLACE VIEW public.community_posts_safe AS
 SELECT id,
    content,
    is_anonymous,
    likes_count,
    created_at,
    updated_at,
        CASE
            WHEN is_anonymous = true AND user_id <> auth.uid() AND NOT is_admin() THEN NULL::uuid
            ELSE user_id
        END AS user_id,
    category,
    image_url,
    comments_count,
    image_urls,
    ((likes_count + 2 * comments_count + 1)::numeric / power(GREATEST(EXTRACT(epoch FROM now() - created_at) / 3600.0, 0::numeric) + 2::numeric, 1.5))::double precision AS hot_score,
    user_id = auth.uid() AS is_mine
   FROM community_posts;

-- =====================================================================
-- 4) INDEX (hors clés primaires / uniques déjà déclarées)
-- =====================================================================

CREATE INDEX idx_admin_logs_admin_id ON public.admin_logs USING btree (admin_id);
CREATE INDEX idx_app_settings_updated_by ON public.app_settings USING btree (updated_by);
CREATE INDEX idx_appointments_date ON public.appointments USING btree (appointment_date);
CREATE INDEX idx_appointments_doctor ON public.appointments USING btree (doctor_id);
CREATE INDEX idx_appointments_patient ON public.appointments USING btree (patient_id);
CREATE INDEX idx_appointments_status ON public.appointments USING btree (status);
CREATE UNIQUE INDEX uq_appointment_slot ON public.appointments USING btree (doctor_id, appointment_date, appointment_time) WHERE (status <> 'cancelled'::appointment_status);
CREATE INDEX idx_comment_likes_user_id ON public.comment_likes USING btree (user_id);
CREATE INDEX idx_comments_post ON public.community_comments USING btree (post_id);
CREATE INDEX idx_comments_user ON public.community_comments USING btree (user_id);
CREATE INDEX idx_community_comments_parent_comment_id ON public.community_comments USING btree (parent_comment_id);
CREATE INDEX idx_likes_post ON public.community_likes USING btree (post_id);
CREATE INDEX idx_likes_user ON public.community_likes USING btree (user_id);
CREATE INDEX idx_posts_created ON public.community_posts USING btree (created_at DESC);
CREATE INDEX idx_posts_user ON public.community_posts USING btree (user_id);
CREATE INDEX idx_doctor_messages_doctor_id ON public.doctor_messages USING btree (doctor_id);
CREATE INDEX idx_doctor_messages_thread ON public.doctor_messages USING btree (patient_id, doctor_id, created_at);
CREATE INDEX idx_doctor_reviews_patient_id ON public.doctor_reviews USING btree (patient_id);
CREATE INDEX idx_doctors_specialty ON public.doctors USING btree (specialty);
CREATE INDEX idx_doctors_user ON public.doctors USING btree (user_id);
CREATE INDEX idx_doctors_validated ON public.doctors USING btree (is_validated);
CREATE INDEX idx_doctors_validated_by ON public.doctors USING btree (validated_by);
CREATE INDEX idx_legal_consents_user ON public.legal_consents USING btree (user_id);
CREATE INDEX idx_orders_status ON public.marketplace_orders USING btree (status);
CREATE INDEX idx_orders_user ON public.marketplace_orders USING btree (user_id);
CREATE INDEX idx_products_active ON public.marketplace_products USING btree (is_active);
CREATE INDEX idx_cycles_start ON public.menstrual_cycles USING btree (period_start);
CREATE INDEX idx_cycles_user ON public.menstrual_cycles USING btree (user_id);
CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX idx_order_events_order ON public.order_events USING btree (order_id, created_at);
CREATE INDEX idx_payment_events_target ON public.payment_events USING btree (target_type, target_id);
CREATE INDEX idx_post_bookmarks_post_id ON public.post_bookmarks USING btree (post_id);
CREATE INDEX idx_product_favorites_product_id ON public.product_favorites USING btree (product_id);
CREATE INDEX idx_product_reviews_user_id ON public.product_reviews USING btree (user_id);
CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);
CREATE INDEX idx_store_settings_updated_by ON public.store_settings USING btree (updated_by);
CREATE INDEX idx_user_blocks_blocked_id ON public.user_blocks USING btree (blocked_id);
CREATE INDEX idx_follows_followed ON public.user_follows USING btree (followed_id);
CREATE INDEX idx_follows_follower ON public.user_follows USING btree (follower_id);
CREATE INDEX idx_user_reports_post_id ON public.user_reports USING btree (post_id);
CREATE INDEX idx_user_reports_reported_user_id ON public.user_reports USING btree (reported_user_id);
CREATE INDEX idx_user_reports_reporter_id ON public.user_reports USING btree (reporter_id);
CREATE INDEX idx_user_suspensions_suspended_by ON public.user_suspensions USING btree (suspended_by);
CREATE INDEX idx_user_suspensions_user_id ON public.user_suspensions USING btree (user_id);

-- =====================================================================
-- 5) ROW LEVEL SECURITY (activation)
-- =====================================================================

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banned_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menstrual_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- NOTE : Les définitions exactes des 43 FONCTIONS, 37 TRIGGERS et
-- 96 POLITIQUES RLS sont ajoutées dans la 2e partie de ce fichier
-- (voir full_schema_part2.sql) — assemblées depuis pg_get_functiondef /
-- pg_get_triggerdef / pg_policies.
-- =====================================================================

-- =====================================================================
-- Hygiena+ — Snapshot schéma Supabase — PARTIE 2 / 2
-- Fonctions (43), Triggers (37), Politiques RLS (96)
-- Généré le 2026-07-06 par introspection lecture seule (pg_get_functiondef,
-- pg_get_triggerdef, pg_policies). À concaténer après full_schema.sql.
-- =====================================================================

-- =====================================================================
-- 6) FONCTIONS
-- =====================================================================

CREATE OR REPLACE FUNCTION public.admin_appointments_list(p_status text DEFAULT NULL::text, p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, patient_name text, doctor_name text, specialty text, appointment_date date, appointment_time time without time zone, status text, consultation_mode text, is_paid boolean, amount_paid numeric, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    return;
  end if;
  return query
    select a.id,
           pp.full_name as patient_name,
           dp.full_name as doctor_name,
           d.specialty,
           a.appointment_date,
           a.appointment_time,
           a.status::text,
           a.consultation_mode,
           a.is_paid,
           a.amount_paid,
           a.created_at
    from public.appointments a
    left join public.profiles pp on pp.id = a.patient_id
    left join public.doctors d on d.id = a.doctor_id
    left join public.profiles dp on dp.id = d.user_id
    where (p_status is null or a.status::text = p_status)
    order by a.appointment_date desc, a.appointment_time desc
    limit greatest(p_limit, 1) offset greatest(p_offset, 0);
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_broadcast(p_title text, p_message text, p_audience text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_count int;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'Réservé aux administrateurs.');
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_message), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Titre et message requis.');
  end if;
  if p_audience not in ('all', 'user', 'doctor') then
    return jsonb_build_object('ok', false, 'error', 'Public invalide.');
  end if;

  insert into public.notifications (user_id, title, message, type)
  select p.id, p_title, p_message, 'admin_broadcast'
  from public.profiles p
  where case
    when p_audience = 'all' then true
    when p_audience = 'user' then p.role = 'user'
    when p_audience = 'doctor' then p.role = 'doctor'
    else false
  end;
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'count', v_count);
end; $function$;

CREATE OR REPLACE FUNCTION public.admin_broadcast_count(p_audience text)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when public.is_admin() then (
    select count(*)::int from public.profiles p
    where case
      when p_audience = 'all' then true
      when p_audience = 'user' then p.role = 'user'
      when p_audience = 'doctor' then p.role = 'doctor'
      else false
    end
  ) else 0 end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v jsonb;
  v_users int; v_active int; v_doctors_active int;
  v_appts_today int; v_orders_total int; v_orders_pending int;
  v_posts int; v_reports_pending int;
  v_rev_marketplace numeric; v_rev_consultation numeric;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'Réservé aux administrateurs.');
  end if;

  select count(*) into v_users from public.profiles;
  select count(*) into v_active from auth.users
    where last_sign_in_at is not null and last_sign_in_at > now() - interval '30 days';
  select count(*) into v_doctors_active from public.doctors where is_validated = true;
  select count(*) into v_appts_today from public.appointments where appointment_date = current_date;
  select count(*) into v_orders_total from public.marketplace_orders;
  select count(*) into v_orders_pending from public.marketplace_orders where status = 'pending';
  select count(*) into v_posts from public.community_posts;
  select count(*) into v_reports_pending from public.user_reports where status = 'pending';

  select coalesce(sum(total_amount), 0) into v_rev_marketplace
    from public.marketplace_orders
    where status <> 'cancelled'
      and created_at >= date_trunc('month', current_date);
  select coalesce(sum(amount_paid), 0) into v_rev_consultation
    from public.appointments
    where is_paid = true
      and coalesce(paid_at, created_at) >= date_trunc('month', current_date);

  v := jsonb_build_object(
    'ok', true,
    'usersTotal', v_users,
    'activeUsers', v_active,
    'doctorsActive', v_doctors_active,
    'appointmentsToday', v_appts_today,
    'ordersTotal', v_orders_total,
    'ordersPending', v_orders_pending,
    'postsCount', v_posts,
    'reportsPending', v_reports_pending,
    'revenueMarketplace', v_rev_marketplace,
    'revenueConsultation', v_rev_consultation,
    'revenueTotal', v_rev_marketplace + v_rev_consultation
  );
  return v;
end;
$function$;

CREATE OR REPLACE FUNCTION public.check_banned_words()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_word text;
begin
  select bw.word into v_word
  from public.banned_words bw
  where bw.is_active = true
    and position(lower(bw.word) in lower(coalesce(new.content, ''))) > 0
  limit 1;
  if v_word is not null then
    raise exception 'banned_word_detected';
  end if;
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.create_marketplace_order(p_items jsonb, p_phone text, p_delivery_mode text, p_neighborhood text, p_instructions text, p_payment_method text, p_payment_phone text)
 RETURNS marketplace_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_item jsonb; v_pid uuid; v_qty int; v_prod record;
  v_subtotal numeric := 0; v_items jsonb := '[]'::jsonb;
  v_mode text := coalesce(nullif(p_delivery_mode, ''), 'delivery');
  v_fee numeric := 0; v_store record; v_zone jsonb; v_zonefee numeric;
  v_order public.marketplace_orders;
begin
  if v_uid is null then raise exception 'Authentification requise' using errcode = '42501'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Panier vide' using errcode = '22023'; end if;
  if v_mode not in ('delivery', 'pickup') then
    raise exception 'Mode de livraison invalide' using errcode = '22023'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    if v_qty <= 0 then raise exception 'Quantité invalide' using errcode = '22023'; end if;
    select id, name, price, stock into v_prod
      from public.marketplace_products where id = v_pid and is_active = true for update;
    if not found then raise exception 'Produit indisponible' using errcode = '22023'; end if;
    if v_prod.stock < v_qty then
      raise exception 'Stock insuffisant pour %', v_prod.name using errcode = '22023'; end if;
    update public.marketplace_products set stock = stock - v_qty where id = v_pid;
    v_subtotal := v_subtotal + (v_prod.price * v_qty);
    v_items := v_items || jsonb_build_object('product_id', v_prod.id, 'name', v_prod.name, 'price', v_prod.price, 'quantity', v_qty);
  end loop;

  if v_mode = 'delivery' then
    select default_delivery_fee, free_delivery_threshold, delivery_zones into v_store
      from public.store_settings order by created_at asc limit 1;
    if v_store.free_delivery_threshold is not null and v_subtotal >= v_store.free_delivery_threshold then
      v_fee := 0;
    else
      v_zonefee := null;
      if v_store.delivery_zones is not null and coalesce(trim(p_neighborhood), '') <> '' then
        if jsonb_typeof(v_store.delivery_zones) = 'array' then
          for v_zone in select * from jsonb_array_elements(v_store.delivery_zones) loop
            if lower(trim(v_zone->>'name')) = lower(trim(p_neighborhood)) then
              v_zonefee := (v_zone->>'fee')::numeric; exit; end if;
          end loop;
        elsif jsonb_typeof(v_store.delivery_zones) = 'object' then
          select value::text::numeric into v_zonefee from jsonb_each_text(v_store.delivery_zones)
            where lower(trim(key)) = lower(trim(p_neighborhood)) limit 1;
        end if;
      end if;
      v_fee := coalesce(v_zonefee, v_store.default_delivery_fee, 0);
    end if;
  end if;

  insert into public.marketplace_orders (
    user_id, phone, neighborhood, delivery_mode, instructions,
    items, total_amount, payment_method, payment_phone
  ) values (
    v_uid, p_phone,
    case when v_mode = 'delivery' then nullif(trim(p_neighborhood), '') else null end,
    v_mode::public.delivery_mode,
    case when v_mode = 'delivery' then nullif(trim(p_instructions), '') else null end,
    v_items, v_subtotal + v_fee, p_payment_method, p_payment_phone
  ) returning * into v_order;
  return v_order;
end;
$function$;

CREATE OR REPLACE FUNCTION public.doctor_booked_slots(p_doctor uuid, p_from date, p_to date)
 RETURNS TABLE(appointment_date date, appointment_time time without time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.appointment_date, a.appointment_time
  from public.appointments a
  where a.doctor_id = p_doctor
    and a.status <> 'cancelled'
    and a.appointment_date between p_from and p_to;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_appointment_insert_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  new.is_paid := false;
  new.amount_paid := null;
  new.paid_at := null;
  new.receipt_number := null;
  if new.status is distinct from 'pending' then
    new.status := 'pending';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_appointment_update_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare is_patient boolean; is_doctor boolean;
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then return new; end if;
  if new.is_paid is distinct from old.is_paid
     or new.amount_paid is distinct from old.amount_paid
     or new.paid_at is distinct from old.paid_at
     or new.receipt_number is distinct from old.receipt_number then
    raise exception 'Champs de paiement du rendez-vous non modifiables côté client' using errcode = '42501';
  end if;
  if new.patient_id is distinct from old.patient_id or new.doctor_id is distinct from old.doctor_id then
    raise exception 'patient_id / doctor_id non modifiables' using errcode = '42501';
  end if;
  is_patient := (old.patient_id = auth.uid());
  is_doctor := exists (select 1 from public.doctors d where d.id = old.doctor_id and d.user_id = auth.uid());
  if is_patient and not is_doctor then
    if new.status is distinct from old.status and new.status not in ('cancelled', 'pending') then
      raise exception 'Le patient ne peut qu''annuler ou reporter le rendez-vous' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_content_counters()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if tg_table_name = 'community_posts' then
    if new.likes_count is distinct from old.likes_count
       or new.comments_count is distinct from old.comments_count then
      raise exception 'Compteurs recalculés par le serveur' using errcode = '42501';
    end if;
  elsif tg_table_name = 'community_comments' then
    if new.likes_count is distinct from old.likes_count then
      raise exception 'Compteurs recalculés par le serveur' using errcode = '42501';
    end if;
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'user_id non modifiable' using errcode = '42501';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_doctor_insert_not_validated()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if coalesce(new.is_validated, false) is true then
    raise exception 'Un médecin ne peut pas être créé déjà validé côté client'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_doctor_privileged_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if new.is_validated is distinct from old.is_validated
     or new.validated_by is distinct from old.validated_by
     or new.validated_at is distinct from old.validated_at then
    raise exception 'La validation d''un médecin est réservée à l''administration'
      using errcode = '42501';
  end if;

  if new.rating_avg is distinct from old.rating_avg
     or new.rating_count is distinct from old.rating_count then
    raise exception 'La note d''un médecin est calculée par le serveur'
      using errcode = '42501';
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'user_id non modifiable' using errcode = '42501';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_order_payment_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.is_paid, false) is true or new.paid_at is not null then
      raise exception 'Une commande ne peut pas être créée comme payée côté client'
        using errcode = '42501';
    end if;
    if coalesce(new.total_amount, 0) < 0 then
      raise exception 'Montant de commande invalide' using errcode = '22003';
    end if;
    return new;
  end if;

  if new.is_paid      is distinct from old.is_paid
     or new.paid_at   is distinct from old.paid_at
     or new.total_amount is distinct from old.total_amount
     or new.items     is distinct from old.items
     or new.user_id   is distinct from old.user_id then
    raise exception 'Champs protégés de la commande non modifiables côté client'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_profile_privileged_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'role ne peut être modifié que par le serveur'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.generate_reminders()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_next date; v_ovu date; v_fert date; v_clen int;
  v_first_next date; v_late int;
begin
  -- RAPPELS DE CYCLE
  for r in
    select distinct on (mc.user_id)
      mc.user_id as uid, mc.period_start as pstart, mc.period_end as pend,
      coalesce(mc.cycle_length, 28) as clen
    from public.menstrual_cycles mc
    where mc.period_start is not null
    order by mc.user_id, mc.period_start desc
  loop
    v_clen := greatest(r.clen, 20);
    v_first_next := r.pstart + v_clen;
    v_next := r.pstart;
    while v_next < current_date loop v_next := v_next + v_clen; end loop;
    v_ovu := v_next - 14;
    v_fert := v_ovu - 5;

    if v_next - current_date = 3 then
      perform public.notify_once(r.uid, 'cycle_period_soon', 'Tes règles approchent',
        'Tes prochaines règles sont estimées dans 3 jours. Pense à te préparer.');
    end if;
    if v_fert = current_date then
      perform public.notify_once(r.uid, 'cycle_fertile', 'Fenêtre fertile',
        'Ta fenêtre fertile commence aujourd''hui.');
    end if;
    if v_ovu = current_date then
      perform public.notify_once(r.uid, 'cycle_ovulation', 'Ovulation',
        'Ton ovulation est estimée pour aujourd''hui.');
    end if;

    v_late := current_date - v_first_next;
    if v_late in (2, 5) then
      perform public.notify_once(r.uid, 'cycle_period_late', 'Tes règles ont du retard',
        'Tes règles ont ' || v_late || ' jours de retard. Si elles sont arrivées, pense à les enregistrer. Un léger retard est souvent normal.');
    end if;

    if current_date >= r.pstart and current_date <= r.pstart + 7
       and (r.pend is null or current_date <= r.pend) then
      perform public.notify_once(r.uid, 'cycle_log_daily', 'Pense à enregistrer ton cycle',
        'Tes règles sont en cours. Note ton flux, tes symptômes et ton ressenti du jour.');
    end if;
  end loop;

  -- RAPPELS DE RDV (confirmés, prévus demain)
  for r in
    select a.id as aid, a.patient_id as pid, a.appointment_time as atime
    from public.appointments a
    where a.status = 'confirmed' and a.appointment_date = current_date + 1
  loop
    if not exists (
      select 1 from public.notifications n
      where n.user_id = r.pid and n.type = 'appointment_reminder'
        and n.data->>'appointmentId' = r.aid::text
        and n.created_at::date = current_date
    ) then
      insert into public.notifications (user_id, title, message, type, data)
      values (r.pid, 'Rappel de rendez-vous',
        'Vous avez un rendez-vous demain à ' || to_char(r.atime, 'HH24:MI') || '.',
        'appointment_reminder',
        jsonb_build_object('kind', 'my_appointments', 'appointmentId', r.aid));
    end if;
  end loop;

  -- DEMANDE D'AVIS : commande livrée il y a 2 jours -> invitation à noter.
  for r in
    select o.id as oid, o.user_id as uid
    from public.marketplace_orders o
    where o.status = 'completed'
      and o.updated_at::date = current_date - 2
  loop
    if not exists (
      select 1 from public.notifications n
      where n.user_id = r.uid and n.type = 'order_review'
        and n.data->>'orderId' = r.oid::text
    ) then
      insert into public.notifications (user_id, title, message, type, data)
      values (r.uid, 'Ton avis compte ⭐',
        'Ta commande est bien arrivée ? Prends 30 secondes pour noter tes produits — ça aide toute la communauté.',
        'order_review',
        jsonb_build_object('kind', 'orders', 'orderId', r.oid));
    end if;
  end loop;
end; $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do nothing;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_suspended(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.user_suspensions s
    where s.user_id = uid
      and s.is_active = true
      and (s.ends_at is null or s.ends_at > now())
  );
$function$;

CREATE OR REPLACE FUNCTION public.legal_consents_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  raise exception 'legal_consents est append-only' using errcode = '42501';
end;
$function$;

CREATE OR REPLACE FUNCTION public.log_order_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_events (order_id, status, created_at)
    VALUES (NEW.id, NEW.status, NEW.created_at);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_events (order_id, status)
    VALUES (NEW.id, NEW.status);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_doctor_thread_read(p_doctor uuid, p_patient uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_doc_user uuid;
begin
  if v_uid is null then
    return;
  end if;

  select user_id into v_doc_user from public.doctors where id = p_doctor;

  if v_uid = p_patient then
    update public.doctor_messages
      set read_at = now()
      where doctor_id = p_doctor and patient_id = p_patient
        and sender_role = 'doctor' and read_at is null;
  elsif v_uid = v_doc_user then
    update public.doctor_messages
      set read_at = now()
      where doctor_id = p_doctor and patient_id = p_patient
        and sender_role = 'patient' and read_at is null;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_appointment_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_doc_user uuid;
begin
  select user_id into v_doc_user from public.doctors where id = new.doctor_id;
  if v_doc_user is not null then
    insert into public.notifications (user_id, title, message, type, data)
    values (v_doc_user, 'Nouveau rendez-vous',
            'Une patiente a réservé un rendez-vous.',
            'appointment_new',
            jsonb_build_object('kind', 'doctor_appointments'));
  end if;
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.notify_on_appointment_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_title text; v_msg text;
begin
  if new.status is distinct from old.status then
    if new.status = 'confirmed' then
      v_title := 'Rendez-vous confirmé'; v_msg := 'Votre rendez-vous a été confirmé par le médecin.';
    elsif new.status = 'cancelled' then
      v_title := 'Rendez-vous annulé'; v_msg := 'Votre rendez-vous a été annulé.';
    elsif new.status = 'completed' then
      v_title := 'Consultation terminée'; v_msg := 'Votre consultation est marquée comme terminée.';
    else
      v_title := null;
    end if;
    if v_title is not null then
      insert into public.notifications (user_id, title, message, type, data)
      values (new.patient_id, v_title, v_msg, 'appointment_status',
              jsonb_build_object('kind', 'my_appointments'));
    end if;
  elsif (new.appointment_date is distinct from old.appointment_date)
        or (new.appointment_time is distinct from old.appointment_time) then
    insert into public.notifications (user_id, title, message, type, data)
    values (new.patient_id, 'Rendez-vous reporté',
            'Votre rendez-vous a été reporté au ' || to_char(new.appointment_date, 'DD/MM/YYYY')
              || ' à ' || to_char(new.appointment_time, 'HH24:MI') || '.',
            'appointment_status',
            jsonb_build_object('kind', 'my_appointments'));
  end if;
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.notify_on_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_author uuid; v_parent_author uuid; v_excerpt text;
begin
  v_excerpt := left(coalesce(new.content, ''), 80);
  select user_id into v_author from public.community_posts where id = new.post_id;
  if v_author is not null and v_author <> new.user_id then
    insert into public.notifications (user_id, title, message, type, data)
    values (v_author, 'Nouvelle réponse',
            'Quelqu''un a répondu à votre publication : ' || v_excerpt,
            'community_comment',
            jsonb_build_object('kind', 'post', 'postId', new.post_id));
  end if;
  if new.parent_comment_id is not null then
    select user_id into v_parent_author from public.community_comments where id = new.parent_comment_id;
    if v_parent_author is not null and v_parent_author <> new.user_id and v_parent_author is distinct from v_author then
      insert into public.notifications (user_id, title, message, type, data)
      values (v_parent_author, 'Réponse à votre commentaire',
              'Quelqu''un a répondu à votre commentaire : ' || v_excerpt,
              'community_reply',
              jsonb_build_object('kind', 'post', 'postId', new.post_id));
    end if;
  end if;
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.notify_on_doctor_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_doc_user uuid; v_excerpt text;
begin
  v_excerpt := left(coalesce(new.content, ''), 80);
  select user_id into v_doc_user from public.doctors where id = new.doctor_id;
  if new.sender_role = 'doctor' then
    insert into public.notifications (user_id, title, message, type, data)
    values (new.patient_id, 'Message de votre médecin',
            'Votre médecin vous a répondu : ' || v_excerpt,
            'doctor_message',
            jsonb_build_object('kind', 'patient_chat', 'doctorId', new.doctor_id, 'patientId', new.patient_id));
  elsif new.sender_role = 'patient' then
    if v_doc_user is not null then
      insert into public.notifications (user_id, title, message, type, data)
      values (v_doc_user, 'Nouveau message',
              'Une patiente vous a écrit : ' || v_excerpt,
              'doctor_message',
              jsonb_build_object('kind', 'doctor_chat', 'doctorId', new.doctor_id, 'patientId', new.patient_id));
    end if;
  end if;
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.notify_on_follow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(full_name), ''), 'Quelqu''un') INTO v_name
  FROM profiles WHERE id = NEW.follower_id;
  INSERT INTO notifications (user_id, title, message, type, data)
  VALUES (
    NEW.followed_id,
    'Nouvelle abonnée 💚',
    v_name || ' te suit maintenant sur Hygiena+',
    'community',
    jsonb_build_object('kind', 'follow', 'follower_id', NEW.follower_id)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_like()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_author uuid;
begin
  select user_id into v_author from public.community_posts where id = new.post_id;
  if v_author is not null and v_author <> new.user_id then
    insert into public.notifications (user_id, title, message, type, data)
    values (v_author, 'Nouveau j''aime',
            'Quelqu''un a aimé votre publication.',
            'community_like',
            jsonb_build_object('kind', 'post', 'postId', new.post_id));
  end if;
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.notify_on_order_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_title text; v_msg text; v_pickup boolean;
begin
  if new.status is distinct from old.status then
    v_pickup := (new.delivery_mode = 'pickup');
    if new.status = 'confirmed' then
      v_title := 'Commande confirmée ✅'; v_msg := 'Bonne nouvelle : ta commande a été confirmée par la boutique.';
    elsif new.status = 'preparing' then
      v_title := 'Commande en préparation 📦'; v_msg := 'Ta commande est préparée avec soin.';
    elsif new.status = 'delivering' then
      if v_pickup then
        v_title := 'Commande prête pour le retrait 🏬';
        v_msg := 'Ta commande t''attend ! Tu peux venir la retirer en boutique.';
      else
        v_title := 'Commande en route 🛵'; v_msg := 'Ta commande est partie — elle arrive vers toi !';
      end if;
    elsif new.status = 'completed' then
      if v_pickup then
        v_title := 'Commande retirée 💜'; v_msg := 'Merci pour ton achat ! À très vite sur Hygiena+.';
      else
        v_title := 'Commande livrée 💜'; v_msg := 'Ta commande est arrivée. Merci pour ton achat !';
      end if;
    elsif new.status = 'cancelled' then
      v_title := 'Commande annulée'; v_msg := 'Ta commande a été annulée. Contacte-nous si tu as une question.';
    else
      return new;
    end if;
    insert into public.notifications (user_id, title, message, type, data)
    values (new.user_id, v_title, v_msg, 'order_status',
            jsonb_build_object('kind', 'order', 'orderId', new.id));
  end if;
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.notify_once(p_user uuid, p_type text, p_title text, p_msg text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from public.notifications n
    where n.user_id = p_user and n.type = p_type and n.created_at::date = current_date
  ) then
    insert into public.notifications (user_id, title, message, type)
    values (p_user, p_title, p_msg, p_type);
  end if;
end; $function$;

CREATE OR REPLACE FUNCTION public.prevent_role_self_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Seul un administrateur peut modifier le role.';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_comment_likes(p_comment uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.community_comments c
    set likes_count = (select count(*) from public.comment_likes cl where cl.comment_id = p_comment)
  where c.id = p_comment;
end; $function$;

CREATE OR REPLACE FUNCTION public.refresh_doctor_rating(p_doctor uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.doctors d set
    rating_count = (select count(*) from public.doctor_reviews r where r.doctor_id = p_doctor),
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.doctor_reviews r where r.doctor_id = p_doctor), 0)
  where d.id = p_doctor;
end; $function$;

CREATE OR REPLACE FUNCTION public.refresh_post_comments_count(p_post uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.community_posts p
    set comments_count = (select count(*) from public.community_comments c where c.post_id = p_post)
  where p.id = p_post;
end; $function$;

CREATE OR REPLACE FUNCTION public.refresh_product_rating(p_product uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.marketplace_products p set
    rating_count = (select count(*) from public.product_reviews r where r.product_id = p_product),
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.product_reviews r where r.product_id = p_product), 0)
  where p.id = p_product;
end; $function$;

CREATE OR REPLACE FUNCTION public.send_expo_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tokens text[];
BEGIN
  SELECT array_agg(token) INTO v_tokens
  FROM push_tokens
  WHERE user_id = NEW.user_id
    AND token LIKE 'ExponentPushToken%';

  IF v_tokens IS NULL OR array_length(v_tokens, 1) = 0 THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := jsonb_build_object(
        'to', to_jsonb(v_tokens),
        'title', NEW.title,
        'body', NEW.message,
        'sound', 'default',
        'priority', 'high',
        'channelId', 'default',
        'data', COALESCE(NEW.data, '{}'::jsonb) || jsonb_build_object('type', NEW.type, 'notificationId', NEW.id)
      ),
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
      timeout_milliseconds := 8000
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_post_likes_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_follow(p_target uuid)
 RETURNS TABLE(following boolean, followers_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_deleted integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF v_user = p_target THEN RAISE EXCEPTION 'cannot_follow_self'; END IF;

  DELETE FROM user_follows WHERE follower_id = v_user AND followed_id = p_target;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    INSERT INTO user_follows (follower_id, followed_id) VALUES (v_user, p_target)
    ON CONFLICT DO NOTHING;
    following := true;
  ELSE
    following := false;
  END IF;

  SELECT COUNT(*)::integer INTO followers_count FROM user_follows WHERE followed_id = p_target;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_like(p_post_id uuid)
 RETURNS TABLE(liked boolean, likes_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_deleted integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  DELETE FROM community_likes WHERE post_id = p_post_id AND user_id = v_user;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    INSERT INTO community_likes (post_id, user_id) VALUES (p_post_id, v_user)
    ON CONFLICT DO NOTHING;
    liked := true;
  ELSE
    liked := false;
  END IF;

  SELECT p.likes_count INTO likes_count FROM community_posts p WHERE p.id = p_post_id;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_comment_like()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.refresh_comment_likes(coalesce(new.comment_id, old.comment_id));
  return null;
end; $function$;

CREATE OR REPLACE FUNCTION public.trg_doctor_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.refresh_doctor_rating(coalesce(new.doctor_id, old.doctor_id));
  return null;
end; $function$;

CREATE OR REPLACE FUNCTION public.trg_post_comment_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.refresh_post_comments_count(coalesce(new.post_id, old.post_id));
  return null;
end; $function$;

CREATE OR REPLACE FUNCTION public.trg_product_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.refresh_product_rating(coalesce(new.product_id, old.product_id));
  return null;
end; $function$;

-- =====================================================================
-- 7) TRIGGERS
-- =====================================================================

CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_appointments_insert_payment BEFORE INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION enforce_appointment_insert_payment();
CREATE TRIGGER trg_appointments_update_integrity BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION enforce_appointment_update_integrity();
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_notify_on_appointment_insert AFTER INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION notify_on_appointment_insert();
CREATE TRIGGER trg_notify_on_appointment_status AFTER UPDATE OF status ON public.appointments FOR EACH ROW EXECUTE FUNCTION notify_on_appointment_status();
CREATE TRIGGER trg_comment_like_aiud AFTER INSERT OR DELETE ON public.comment_likes FOR EACH ROW EXECUTE FUNCTION trg_comment_like();
CREATE TRIGGER trg_check_banned_words_comments BEFORE INSERT ON public.community_comments FOR EACH ROW EXECUTE FUNCTION check_banned_words();
CREATE TRIGGER trg_comments_counters BEFORE UPDATE ON public.community_comments FOR EACH ROW EXECUTE FUNCTION enforce_content_counters();
CREATE TRIGGER trg_comments_updated BEFORE UPDATE ON public.community_comments FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_notify_on_comment AFTER INSERT ON public.community_comments FOR EACH ROW EXECUTE FUNCTION notify_on_comment();
CREATE TRIGGER trg_post_comment_count_aiud AFTER INSERT OR DELETE ON public.community_comments FOR EACH ROW EXECUTE FUNCTION trg_post_comment_count();
CREATE TRIGGER trg_notify_on_like AFTER INSERT ON public.community_likes FOR EACH ROW EXECUTE FUNCTION notify_on_like();
CREATE TRIGGER trg_post_like_aiud AFTER INSERT OR DELETE ON public.community_likes FOR EACH ROW EXECUTE FUNCTION sync_post_likes_count();
CREATE TRIGGER trg_check_banned_words_posts BEFORE INSERT ON public.community_posts FOR EACH ROW EXECUTE FUNCTION check_banned_words();
CREATE TRIGGER trg_posts_counters BEFORE UPDATE ON public.community_posts FOR EACH ROW EXECUTE FUNCTION enforce_content_counters();
CREATE TRIGGER trg_posts_updated BEFORE UPDATE ON public.community_posts FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_notify_on_doctor_message AFTER INSERT ON public.doctor_messages FOR EACH ROW EXECUTE FUNCTION notify_on_doctor_message();
CREATE TRIGGER trg_doctor_review_aiud AFTER INSERT OR DELETE OR UPDATE ON public.doctor_reviews FOR EACH ROW EXECUTE FUNCTION trg_doctor_review();
CREATE TRIGGER trg_doctors_insert_not_validated BEFORE INSERT ON public.doctors FOR EACH ROW EXECUTE FUNCTION enforce_doctor_insert_not_validated();
CREATE TRIGGER trg_doctors_privileged_columns BEFORE UPDATE ON public.doctors FOR EACH ROW EXECUTE FUNCTION enforce_doctor_privileged_columns();
CREATE TRIGGER trg_doctors_updated BEFORE UPDATE ON public.doctors FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_legal_consents_append_only BEFORE DELETE OR UPDATE ON public.legal_consents FOR EACH ROW EXECUTE FUNCTION legal_consents_append_only();
CREATE TRIGGER trg_log_order_event_ins AFTER INSERT ON public.marketplace_orders FOR EACH ROW EXECUTE FUNCTION log_order_event();
CREATE TRIGGER trg_log_order_event_upd AFTER UPDATE ON public.marketplace_orders FOR EACH ROW EXECUTE FUNCTION log_order_event();
CREATE TRIGGER trg_notify_on_order_status AFTER UPDATE OF status ON public.marketplace_orders FOR EACH ROW EXECUTE FUNCTION notify_on_order_status();
CREATE TRIGGER trg_orders_payment_integrity BEFORE INSERT OR UPDATE ON public.marketplace_orders FOR EACH ROW EXECUTE FUNCTION enforce_order_payment_integrity();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.marketplace_orders FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.marketplace_products FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_cycles_updated BEFORE UPDATE ON public.menstrual_cycles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_send_expo_push AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION send_expo_push();
CREATE TRIGGER trg_product_review_aiud AFTER INSERT OR DELETE OR UPDATE ON public.product_reviews FOR EACH ROW EXECUTE FUNCTION trg_product_review();
CREATE TRIGGER trg_prevent_role_self_change BEFORE UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION prevent_role_self_change();
CREATE TRIGGER trg_profiles_privileged_columns BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION enforce_profile_privileged_columns();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_notify_on_follow AFTER INSERT ON public.user_follows FOR EACH ROW EXECUTE FUNCTION notify_on_follow();
CREATE TRIGGER trg_reports_updated BEFORE UPDATE ON public.user_reports FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =====================================================================
-- 8) POLITIQUES RLS (96)
-- =====================================================================

CREATE POLICY logs_admin_all ON public.admin_logs AS PERMISSIVE FOR ALL TO public USING (is_admin());
CREATE POLICY settings_admin_all ON public.app_settings AS PERMISSIVE FOR ALL TO public USING (is_admin());
CREATE POLICY settings_select_all ON public.app_settings AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY appointments_delete_patient_or_admin ON public.appointments AS PERMISSIVE FOR DELETE TO authenticated USING (((auth.uid() = patient_id) OR is_admin()));
CREATE POLICY appointments_insert_patient ON public.appointments AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((patient_id = auth.uid()));
CREATE POLICY appointments_select_doctor ON public.appointments AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM doctors d WHERE ((d.id = appointments.doctor_id) AND (d.user_id = auth.uid())))));
CREATE POLICY appointments_select_patient ON public.appointments AS PERMISSIVE FOR SELECT TO authenticated USING (((patient_id = auth.uid()) OR is_admin()));
CREATE POLICY appointments_update_doctor ON public.appointments AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM doctors d WHERE ((d.id = appointments.doctor_id) AND (d.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM doctors d WHERE ((d.id = appointments.doctor_id) AND (d.user_id = auth.uid())))));
CREATE POLICY appointments_update_patient ON public.appointments AS PERMISSIVE FOR UPDATE TO authenticated USING ((patient_id = auth.uid())) WITH CHECK ((patient_id = auth.uid()));
CREATE POLICY banned_words_admin_all ON public.banned_words AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY banned_words_select_all ON public.banned_words AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.role() = 'authenticated'::text));
CREATE POLICY comment_likes_delete_own ON public.comment_likes AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY comment_likes_insert_own ON public.comment_likes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY comment_likes_select ON public.comment_likes AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY comments_delete_own_or_admin ON public.community_comments AS PERMISSIVE FOR DELETE TO public USING (((auth.uid() = user_id) OR is_admin()));
CREATE POLICY comments_insert_own ON public.community_comments AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY comments_select_all ON public.community_comments AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY comments_update_own_or_admin ON public.community_comments AS PERMISSIVE FOR UPDATE TO public USING (((auth.uid() = user_id) OR is_admin()));
CREATE POLICY likes_delete_own ON public.community_likes AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY likes_insert_own ON public.community_likes AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY likes_select_all ON public.community_likes AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY posts_admin_all ON public.community_posts AS PERMISSIVE FOR ALL TO public USING (is_admin());
CREATE POLICY posts_delete_own_or_admin ON public.community_posts AS PERMISSIVE FOR DELETE TO public USING (((auth.uid() = user_id) OR is_admin()));
CREATE POLICY posts_insert_own ON public.community_posts AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY posts_select_all ON public.community_posts AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY posts_update_own_or_admin ON public.community_posts AS PERMISSIVE FOR UPDATE TO public USING (((auth.uid() = user_id) OR is_admin()));
CREATE POLICY dm_insert_doctor ON public.doctor_messages AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((sender_role = 'doctor'::text) AND (EXISTS ( SELECT 1 FROM doctors d WHERE ((d.id = doctor_messages.doctor_id) AND (d.user_id = auth.uid()))))));
CREATE POLICY dm_insert_patient ON public.doctor_messages AS PERMISSIVE FOR INSERT TO public WITH CHECK (((sender_role = 'patient'::text) AND (patient_id = auth.uid()) AND (EXISTS ( SELECT 1 FROM appointments a WHERE ((a.patient_id = auth.uid()) AND (a.doctor_id = doctor_messages.doctor_id))))));
CREATE POLICY dm_select_doctor ON public.doctor_messages AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM doctors d WHERE ((d.id = doctor_messages.doctor_id) AND (d.user_id = auth.uid())))));
CREATE POLICY dm_select_patient ON public.doctor_messages AS PERMISSIVE FOR SELECT TO public USING ((patient_id = auth.uid()));
CREATE POLICY doctor_reviews_delete_own_or_admin ON public.doctor_reviews AS PERMISSIVE FOR DELETE TO authenticated USING (((patient_id = auth.uid()) OR is_admin()));
CREATE POLICY doctor_reviews_insert_patient ON public.doctor_reviews AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((patient_id = auth.uid()) AND (EXISTS ( SELECT 1 FROM appointments a WHERE ((a.doctor_id = doctor_reviews.doctor_id) AND (a.patient_id = auth.uid()))))));
CREATE POLICY doctor_reviews_select ON public.doctor_reviews AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY doctor_reviews_update_own ON public.doctor_reviews AS PERMISSIVE FOR UPDATE TO authenticated USING ((patient_id = auth.uid())) WITH CHECK ((patient_id = auth.uid()));
CREATE POLICY doctors_delete_admin ON public.doctors AS PERMISSIVE FOR DELETE TO public USING (is_admin());
CREATE POLICY doctors_insert_admin ON public.doctors AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY doctors_select_validated ON public.doctors AS PERMISSIVE FOR SELECT TO public USING ((((is_validated = true) AND (NOT is_suspended(user_id))) OR (user_id = auth.uid()) OR is_admin()));
CREATE POLICY doctors_update_owner_or_admin ON public.doctors AS PERMISSIVE FOR UPDATE TO public USING (((auth.uid() = user_id) OR is_admin()));
CREATE POLICY health_profiles_delete_own ON public.health_profiles AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY health_profiles_insert_own ON public.health_profiles AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY health_profiles_select_own ON public.health_profiles AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY health_profiles_update_own ON public.health_profiles AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY legal_consents_insert_own ON public.legal_consents AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY legal_consents_select_own_or_admin ON public.legal_consents AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR is_admin()));
CREATE POLICY orders_admin_all ON public.marketplace_orders AS PERMISSIVE FOR ALL TO public USING (is_admin());
CREATE POLICY orders_delete_admin ON public.marketplace_orders AS PERMISSIVE FOR DELETE TO public USING (is_admin());
CREATE POLICY orders_insert_own ON public.marketplace_orders AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY orders_select_own_or_admin ON public.marketplace_orders AS PERMISSIVE FOR SELECT TO public USING (((auth.uid() = user_id) OR is_admin()));
CREATE POLICY orders_update_admin ON public.marketplace_orders AS PERMISSIVE FOR UPDATE TO public USING (is_admin());
CREATE POLICY orders_update_own ON public.marketplace_orders AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY products_admin_all ON public.marketplace_products AS PERMISSIVE FOR ALL TO public USING (is_admin());
CREATE POLICY products_delete_admin ON public.marketplace_products AS PERMISSIVE FOR DELETE TO public USING (is_admin());
CREATE POLICY products_insert_admin ON public.marketplace_products AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY products_select_active_or_admin ON public.marketplace_products AS PERMISSIVE FOR SELECT TO public USING (((is_active = true) OR is_admin()));
CREATE POLICY products_update_admin ON public.marketplace_products AS PERMISSIVE FOR UPDATE TO public USING (is_admin());
CREATE POLICY cycles_all_own ON public.menstrual_cycles AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY notifications_delete_own ON public.notifications AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY notifications_insert_admin ON public.notifications AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY notifications_select_own ON public.notifications AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY notifications_update_own ON public.notifications AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY order_events_select_own_or_admin ON public.order_events AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM marketplace_orders o WHERE ((o.id = order_events.order_id) AND ((o.user_id = auth.uid()) OR is_admin())))));
CREATE POLICY payment_events_select_admin ON public.payment_events AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY post_bookmarks_delete_own ON public.post_bookmarks AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY post_bookmarks_insert_own ON public.post_bookmarks AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY post_bookmarks_select_own ON public.post_bookmarks AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY product_favorites_delete_own ON public.product_favorites AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY product_favorites_insert_own ON public.product_favorites AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY product_favorites_select_own ON public.product_favorites AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY product_reviews_delete_own_or_admin ON public.product_reviews AS PERMISSIVE FOR DELETE TO authenticated USING (((user_id = auth.uid()) OR is_admin()));
CREATE POLICY product_reviews_insert_own ON public.product_reviews AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY product_reviews_select ON public.product_reviews AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY product_reviews_update_own ON public.product_reviews AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY profiles_admin_all ON public.profiles AS PERMISSIVE FOR ALL TO public USING (is_admin());
CREATE POLICY profiles_insert_own ON public.profiles AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = id));
CREATE POLICY profiles_select_doctor_message_patients ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM (doctor_messages m JOIN doctors d ON ((d.id = m.doctor_id))) WHERE ((m.patient_id = profiles.id) AND (d.user_id = auth.uid())))));
CREATE POLICY profiles_select_doctor_patients ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM (appointments a JOIN doctors d ON ((d.id = a.doctor_id))) WHERE ((a.patient_id = profiles.id) AND (d.user_id = auth.uid())))));
CREATE POLICY profiles_select_own_or_admin ON public.profiles AS PERMISSIVE FOR SELECT TO public USING (((auth.uid() = id) OR is_admin()));
CREATE POLICY profiles_select_validated_doctor ON public.profiles AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1 FROM doctors d WHERE ((d.user_id = profiles.id) AND (d.is_validated = true) AND (NOT is_suspended(d.user_id))))));
CREATE POLICY profiles_update_own_or_admin ON public.profiles AS PERMISSIVE FOR UPDATE TO public USING (((auth.uid() = id) OR is_admin())) WITH CHECK (((auth.uid() = id) OR is_admin()));
CREATE POLICY push_tokens_delete_own ON public.push_tokens AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY push_tokens_insert_own ON public.push_tokens AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY push_tokens_select_own ON public.push_tokens AS PERMISSIVE FOR SELECT TO public USING (((auth.uid() = user_id) OR is_admin()));
CREATE POLICY push_tokens_update_own ON public.push_tokens AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY store_settings_admin_all ON public.store_settings AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY store_settings_select_all ON public.store_settings AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.role() = 'authenticated'::text));
CREATE POLICY user_blocks_delete_own ON public.user_blocks AS PERMISSIVE FOR DELETE TO authenticated USING ((blocker_id = auth.uid()));
CREATE POLICY user_blocks_insert_own ON public.user_blocks AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((blocker_id = auth.uid()));
CREATE POLICY user_blocks_select_own ON public.user_blocks AS PERMISSIVE FOR SELECT TO authenticated USING ((blocker_id = auth.uid()));
CREATE POLICY follows_delete_own ON public.user_follows AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = follower_id));
CREATE POLICY follows_insert_own ON public.user_follows AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = follower_id));
CREATE POLICY follows_select_all ON public.user_follows AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY reports_admin_all ON public.user_reports AS PERMISSIVE FOR ALL TO public USING (is_admin());
CREATE POLICY reports_insert_authenticated ON public.user_reports AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY reports_select_own_or_admin ON public.user_reports AS PERMISSIVE FOR SELECT TO public USING (((reporter_id = auth.uid()) OR is_admin()));
CREATE POLICY reports_update_admin ON public.user_reports AS PERMISSIVE FOR UPDATE TO public USING (is_admin());
CREATE POLICY suspensions_admin_all ON public.user_suspensions AS PERMISSIVE FOR ALL TO public USING (is_admin());

-- =====================================================================
-- FIN DU SNAPSHOT (partie 2/2)
-- Fonctions déployées hors DB : Edge Functions admin-user-actions,
-- consultation-room, payment-webhook (voir supabase/functions/).
-- Fonction http_post : fournie par l'extension pg_net/http de Supabase.
-- =====================================================================
