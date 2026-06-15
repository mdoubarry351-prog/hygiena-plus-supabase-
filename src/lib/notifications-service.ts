import { supabase } from "@/lib/supabase";
import type { Notification } from "@/lib/database.types";

export const notificationsService = {
  // Notifications de l'utilisateur, les plus récentes en premier.
  async getNotifications(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  // Nombre de notifications non lues (pour le badge de la cloche).
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) throw error;
    return count ?? 0;
  },

  // Marque une notification comme lue.
  async markAsRead(id: string): Promise<void> {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    if (error) throw error;
  },

  // Marque toutes les notifications non lues de l'utilisateur comme lues.
  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) throw error;
  },

  // Supprime une notification (RLS : uniquement les siennes).
  async deleteNotification(id: string): Promise<void> {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) throw error;
  },

  // Supprime toutes les notifications de l'utilisateur.
  async deleteAll(userId: string): Promise<void> {
    const { error } = await supabase.from("notifications").delete().eq("user_id", userId);
    if (error) throw error;
  },
};
