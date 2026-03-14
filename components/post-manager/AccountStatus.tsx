"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Instagram, ChevronDown, ChevronRight, Unplug, RefreshCw } from "lucide-react";
import { getRemainingPublishes } from "@/lib/instagram-rate-limit";
import type { InstagramAccount } from "@/lib/instagram";

interface AccountStatusProps {
  account: InstagramAccount;
  loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefreshToken: () => void;
}

export function AccountStatus({
  account,
  loading,
  onConnect,
  onDisconnect,
  onRefreshToken,
}: AccountStatusProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-pulse rounded-full bg-zinc-700" />
          <span className="text-xs text-zinc-500">Checking connection...</span>
        </div>
      </div>
    );
  }

  if (!account.connected) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-zinc-600" />
              <span className="text-xs text-zinc-500">Not connected</span>
            </div>
            {account.error && (
              <p className="mt-1 text-[10px] text-amber-400">{account.error}</p>
            )}
          </div>
          <Button
            size="sm"
            onClick={onConnect}
            className="h-7 gap-1.5 bg-violet-600 px-3 text-xs text-white hover:bg-violet-700"
          >
            <Instagram className="h-3.5 w-3.5" />
            {account.error ? "Reconnect" : "Connect Instagram"}
          </Button>
        </div>
      </div>
    );
  }

  const remaining = getRemainingPublishes();
  const isTokenWarning =
    account.tokenDaysRemaining !== undefined && account.tokenDaysRemaining < 7;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
        <CollapsibleTrigger className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <Avatar className="h-5 w-5">
              <AvatarImage src={account.profilePictureUrl} />
              <AvatarFallback className="bg-zinc-800 text-[8px]">
                {account.username?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-zinc-300">@{account.username}</span>
            {isTokenWarning && (
              <span className="text-[9px] text-amber-400">
                Token expires in {account.tokenDaysRemaining}d
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600">
              {remaining}/25 posts left
            </span>
            {isOpen ? (
              <ChevronDown className="h-3 w-3 text-zinc-500" />
            ) : (
              <ChevronRight className="h-3 w-3 text-zinc-500" />
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
          <div className="grid grid-cols-2 gap-3 text-[10px]">
            <div>
              <span className="text-zinc-500">Token expires</span>
              <p className="text-zinc-300">
                {account.tokenExpiresAt
                  ? new Date(account.tokenExpiresAt).toLocaleDateString()
                  : "Unknown"}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Days remaining</span>
              <p className="text-zinc-300">{account.tokenDaysRemaining ?? "—"}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshToken}
              className="h-6 gap-1 border-zinc-700 px-2 text-[10px] text-zinc-400"
            >
              <RefreshCw className="h-2.5 w-2.5" />
              Refresh Token
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDisconnect}
              className="h-6 gap-1 border-zinc-700 px-2 text-[10px] text-red-400 hover:text-red-300"
            >
              <Unplug className="h-2.5 w-2.5" />
              Disconnect
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
