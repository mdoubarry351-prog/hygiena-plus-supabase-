import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { Loading } from "@/components/Loading";
import { homeRouteForRole } from "@/utils/route";

export default function Index() {
  const { session, profile, initializing } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;

    if (!session) {
      router.replace("/(auth)/login");
      return;
    }
    // Session présente mais profil pas encore chargé : on attend.
    if (!profile) return;

    router.replace(homeRouteForRole(profile.role));
  }, [session, profile, initializing, router]);

  return <Loading />;
}
