"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Instagram, RefreshCw, Unplug, ExternalLink } from "lucide-react";
import { useInstagramAccount } from "@/hooks/use-instagram-account";
import { getRemainingPublishes, getPublishCountLast24h } from "@/lib/instagram-rate-limit";

interface InstagramAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstagramAccountDialog({
  open,
  onOpenChange,
}: InstagramAccountDialogProps) {
  const { account, loading, connect, disconnect, refreshToken, refresh } =
    useInstagramAccount();
  const [remaining, setRemaining] = useState(25);
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    if (open) {
      refresh();
      setRemaining(getRemainingPublishes());
      setTodayCount(getPublishCountLast24h());
    }
  }, [open, refresh]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-zinc-800 bg-zinc-950">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <Instagram className="h-5 w-5 text-violet-400" />
            Instagram Account
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Manage your Instagram connection for publishing posts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
            </div>
          ) : account.connected ? (
            <>
              {/* Account info */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={account.profilePictureUrl} />
                    <AvatarFallback className="bg-zinc-800 text-sm">
                      {account.username?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-zinc-100">
                      @{account.username}
                    </p>
                    <Badge className="mt-1 bg-emerald-950 text-emerald-400 border-emerald-800">
                      Connected
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Token & rate limit info */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] text-zinc-500">Token expires</p>
                    <p className="text-sm font-semibold text-zinc-100">
                      {account.tokenExpiresAt
                        ? new Date(account.tokenExpiresAt).toLocaleDateString()
                        : "—"}
                    </p>
                    <p className="text-[10px] text-zinc-600">
                      {account.tokenDaysRemaining ?? 0} days left
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500">Posts today</p>
                    <p className="text-sm font-semibold text-zinc-100">
                      {todayCount}
                    </p>
                    <p className="text-[10px] text-zinc-600">of 25 max</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500">Remaining</p>
                    <p className="text-sm font-semibold text-zinc-100">
                      {remaining}
                    </p>
                    {remaining < 5 && (
                      <Badge className="mt-0.5 bg-amber-950 text-amber-400 border-amber-800 text-[8px]">
                        Low
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Separator className="bg-zinc-800" />

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={refreshToken}
                  className="flex-1 gap-1.5 border-zinc-700 text-zinc-300"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh Token
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    disconnect();
                    onOpenChange(false);
                  }}
                  className="gap-1.5 border-zinc-700 text-red-400 hover:text-red-300"
                >
                  <Unplug className="h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            /* Not connected */
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900">
                <Instagram className="h-7 w-7 text-zinc-600" />
              </div>
              <h3 className="mt-4 text-sm font-medium text-zinc-400">
                Not Connected
              </h3>
              <p className="mt-2 max-w-sm text-xs leading-relaxed text-zinc-600">
                Connect your Instagram Business or Creator account to publish
                posts directly from this app.
              </p>
              <Button
                onClick={connect}
                className="mt-6 gap-2 bg-violet-600 text-white hover:bg-violet-700"
              >
                <Instagram className="h-4 w-4" />
                Connect Instagram Account
              </Button>
              <a
                href="https://developers.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400"
              >
                <ExternalLink className="h-2.5 w-2.5" />
                Meta Developer Dashboard
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
