import { Stack } from "expo-router";
import { RoleGuard } from "@/components/RoleGuard";

export default function DoctorLayout() {
  return (
    <RoleGuard allow="doctor">
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGuard>
  );
}
