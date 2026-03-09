"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import type { InstagramAccount } from "@/lib/instagram";

export function useInstagramAccount() {
  const [account, setAccount] = useState<InstagramAccount>({ connected: false });
  const [loading, setLoading] = useState(true);
  const token = useAuthToken();

  const authHeaders = useCallback((): HeadersInit => {
    return token ? { "x-convex-auth": token } : {};
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/instagram/account", { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAccount(data);
      } else {
        setAccount({ connected: false });
      }
    } catch {
      setAccount({ connected: false });
    } finally {
      setLoading(false);
    }
  }, [token, authHeaders]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    try {
      const res = await fetch("/api/instagram/auth", { headers: authHeaders() });
      if (res.ok) {
        const { authUrl } = await res.json();
        window.location.href = authUrl;
      }
    } catch (error) {
      console.error("Failed to initiate Instagram auth:", error);
    }
  }, [authHeaders]);

  const disconnect = useCallback(async () => {
    try {
      await fetch("/api/instagram/disconnect", { method: "POST", headers: authHeaders() });
      setAccount({ connected: false });
    } catch (error) {
      console.error("Failed to disconnect Instagram:", error);
    }
  }, [authHeaders]);

  const refreshToken = useCallback(async () => {
    try {
      const res = await fetch("/api/instagram/refresh-token", { method: "POST", headers: authHeaders() });
      if (res.ok) {
        await refresh();
      }
    } catch (error) {
      console.error("Failed to refresh token:", error);
    }
  }, [authHeaders, refresh]);

  return {
    account,
    loading,
    refresh,
    connect,
    disconnect,
    refreshToken,
  };
}
