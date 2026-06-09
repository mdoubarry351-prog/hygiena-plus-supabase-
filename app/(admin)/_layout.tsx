import { Stack } from "expo-router";
import { RoleGuard } from "@/components/RoleGuard";

export default function AdminLayout() {
  return (
    <RoleGuard allow="admin">
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGuard>
  );
}
