"use client";
import { useUser } from "@/context/UserContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    } else if (!loading && user && profile && !profile.group_id && pathname !== "/workspace-setup") {
      router.replace("/workspace-setup");
    }
  }, [user, profile, loading, router, pathname]);

  if (loading || !user || (profile && !profile.group_id && pathname !== "/workspace-setup")) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  return <>{children}</>;
} 