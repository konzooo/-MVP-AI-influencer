"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Menu, Images, Coins, Instagram, User, Eye, Zap, Plus, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadTasks, getDueTasks } from "@/lib/task-store";
import { Task } from "@/lib/task-types";
import { TASKS_UPDATED_EVENT, dispatchTasksUpdated } from "@/lib/task-events";
import { runTask } from "@/lib/task-runner";
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
import { AISettingsDialog } from "@/components/settings/AISettingsDialog";

const navItems = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    description: "All posts & creation",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [instagramOpen, setInstagramOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());

  useEffect(() => {
    const handler = () => setTasks(loadTasks());
    window.addEventListener(TASKS_UPDATED_EVENT, handler);

    // In-app scheduler: check for due tasks every 60 seconds
    const pollInterval = setInterval(async () => {
      const due = getDueTasks();
      for (const task of due) {
        console.log(`[Scheduler] Running due task: ${task.name}`);
        await runTask(task);
        dispatchTasksUpdated();
      }
    }, 60_000);

    return () => {
      window.removeEventListener(TASKS_UPDATED_EVENT, handler);
      clearInterval(pollInterval);
    };
  }, []);

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
              <DropdownMenuItem onClick={() => setAiSettingsOpen(true)}>
                <Brain className="h-4 w-4" />
                Settings
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
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
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
                    <item.icon
                      className={cn(
                        "h-4 w-4",
                        isActive ? "text-violet-400" : "text-zinc-500"
                      )}
                    />
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

          {/* Automated Tasks */}
          <div className="mb-3 mt-6 flex items-center justify-between px-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Automated Tasks
            </p>
            <Link
              href="/automated-tasks/new"
              className="flex h-4 w-4 items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              title="New task"
            >
              <Plus className="h-3 w-3" />
            </Link>
          </div>
          <ul className="space-y-0.5">
            {tasks.length === 0 && (
              <li className="px-3 py-2">
                <span className="text-xs italic text-zinc-600">No tasks yet</span>
              </li>
            )}
            {tasks.map((task) => {
              const isActive = pathname === `/automated-tasks/${task.id}`;
              return (
                <li key={task.id}>
                  <Link
                    href={`/automated-tasks/${task.id}`}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    )}
                  >
                    <Zap className="h-3.5 w-3.5 flex-shrink-0 text-violet-400" />
                    <span className="flex-1 truncate text-sm">{task.name}</span>
                    <span
                      className={cn(
                        "h-1.5 w-1.5 flex-shrink-0 rounded-full",
                        task.status === "running" ? "bg-emerald-500" : "bg-zinc-600"
                      )}
                    />
                  </Link>
                </li>
              );
            })}
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
      {aiSettingsOpen ? <AISettingsDialog open={aiSettingsOpen} onOpenChange={setAiSettingsOpen} /> : null}
      <InstagramAccountDialog open={instagramOpen} onOpenChange={setInstagramOpen} />
    </>
  );
}
