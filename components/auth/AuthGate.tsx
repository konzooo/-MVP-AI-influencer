"use client";

import { useConvexAuth } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";

const PUBLIC_ROUTES = ["/login"];

export function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublicRoute) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, isPublicRoute, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated && !isPublicRoute) {
    return null;
  }

  return <>{children}</>;
}
