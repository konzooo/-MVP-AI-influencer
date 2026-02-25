"use client";

import { useState, useEffect, useCallback } from "react";
import type { InstagramAccount } from "@/lib/instagram";

export function useInstagramAccount() {
  const [account, setAccount] = useState<InstagramAccount>({ connected: false });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/instagram/account");
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
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    try {
      const res = await fetch("/api/instagram/auth");
      if (res.ok) {
        const { authUrl } = await res.json();
        window.location.href = authUrl;
      }
    } catch (error) {
      console.error("Failed to initiate Instagram auth:", error);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await fetch("/api/instagram/disconnect", { method: "POST" });
      setAccount({ connected: false });
    } catch (error) {
      console.error("Failed to disconnect Instagram:", error);
    }
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      const res = await fetch("/api/instagram/refresh-token", { method: "POST" });
      if (res.ok) {
        await refresh();
      }
    } catch (error) {
      console.error("Failed to refresh token:", error);
    }
  }, [refresh]);

  return {
    account,
    loading,
    refresh,
    connect,
    disconnect,
    refreshToken,
  };
}
