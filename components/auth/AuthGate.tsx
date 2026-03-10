"use client";

import { useConvexAuth } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";

const PUBLIC_ROUTES = ["/login"];

interface AuthGateProps {
  children: ReactNode;
  sidebar?: ReactNode;
}

export function AuthGate({ children, sidebar }: AuthGateProps) {
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

  // Public routes (e.g. /login) — no sidebar
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Authenticated app shell
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      {sidebar}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
