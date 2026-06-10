import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { notificationsService } from "@/lib/notifications-service";
import type { Notification } from "@/lib/database.types";

export function useNotifications() {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await notificationsService.getNotifications(session.user.id);
      setNotifications(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  useEffect(() => { load(); }, [load]);

  // Marque une notification comme lue, avec mise à jour optimiste de l'UI.
  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    try {
      await notificationsService.markAsRead(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible");
      await load(); // resynchronise en cas d'échec
    }
  }, [load]);

  // Marque toutes les notifications comme lues.
  const markAllAsRead = useCallback(async () => {
    if (!session?.user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await notificationsService.markAllAsRead(session.user.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible");
      await load();
    }
  }, [session?.user, load]);

  const unreadCount = notifications.reduce((n, item) => n + (item.is_read ? 0 : 1), 0);

  return { notifications, unreadCount, loading, error, reload: load, markAsRead, markAllAsRead };
}
