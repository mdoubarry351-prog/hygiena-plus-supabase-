import { Stack } from "expo-router";
import { RoleGuard } from "@/components/RoleGuard";

export default function UserLayout() {
  return (
    <RoleGuard allow="user">
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGuard>
  );
}
