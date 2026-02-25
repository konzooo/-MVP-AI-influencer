"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lightbulb, ImageIcon, Send, Menu, Images, Coins, Instagram, User, Eye, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { CostIndicator } from "@/components/settings/CostIndicator";
import { InstagramAccountDialog } from "@/components/post-manager/InstagramAccountSection";

const navItems = [
  {
    label: "Ideation",
    href: "/creative-lab",
    icon: Lightbulb,
    step: 1,
    description: "Brainstorm & plan posts",
  },
  {
    label: "Image Generation",
    href: "/image-generation",
    icon: ImageIcon,
    step: 2,
    description: "Create visuals",
  },
  {
    label: "Post Manager",
    href: "/post-manager",
    icon: Send,
    step: 3,
    description: "Review & publish",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [instagramOpen, setInstagramOpen] = useState(false);

  return (
    <>
      <aside className="flex h-screen w-64 flex-col border-r border-zinc-800 bg-zinc-950">
        {/* Logo */}
        <div className="flex items-center gap-2 border-b border-zinc-800 px-5 py-5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 hover:bg-violet-700 transition-colors">
                <Menu className="h-4 w-4 text-white" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/reference-library" className="flex items-center gap-2">
                  <Images className="h-4 w-4" />
                  Reference Library
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setInstagramOpen(true)}>
                <Instagram className="h-4 w-4" />
                Instagram Account
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                <Coins className="h-4 w-4" />
                Cost Tracker
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/identity" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Identity Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/transparency" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Transparency & Config
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div>
            <h1 className="text-sm font-semibold text-zinc-100">AI Influencer</h1>
            <p className="text-[10px] text-zinc-500">Content Studio</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          <p className="mb-3 px-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Pipeline
          </p>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      isActive
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold",
                        isActive
                          ? "bg-violet-600 text-white"
                          : "bg-zinc-800 text-zinc-400"
                      )}
                    >
                      {item.step}
                    </div>
                    <div className="flex-1">
                      <span className="block font-medium">{item.label}</span>
                      <span className="block text-[10px] text-zinc-500">
                        {item.description}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Automation */}
          <p className="mb-3 mt-6 px-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Automation
          </p>
          <ul className="space-y-1">
            <li>
              <Link
                href="/automated-tasks"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  pathname.startsWith("/automated-tasks")
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                )}
              >
                <Zap className="h-4 w-4" />
                <div className="flex-1">
                  <span className="block font-medium">Automated Tasks</span>
                  <span className="block text-[10px] text-zinc-500">
                    Recurring posts
                  </span>
                </div>
              </Link>
            </li>
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-zinc-600">MVP v0.1 · localStorage</p>
            <CostIndicator onClick={() => setSettingsOpen(true)} />
          </div>
        </div>
      </aside>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <InstagramAccountDialog open={instagramOpen} onOpenChange={setInstagramOpen} />
    </>
  );
}
