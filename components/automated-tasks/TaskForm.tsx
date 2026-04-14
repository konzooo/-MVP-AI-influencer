"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Task, TaskEditableFields, TaskStatus } from "@/lib/task-types";
import { PostType } from "@/lib/types";

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTask?: Task;
  onSave: (task: TaskEditableFields) => void;
}

const POST_TYPE_OPTIONS: { value: PostType; label: string }[] = [
  { value: "single_image", label: "Single Image" },
  { value: "carousel", label: "Carousel" },
  { value: "story", label: "Story" },
];

const IMAGE_SIZE_OPTIONS = [
  { value: "portrait_4_3", label: "Portrait 4:3 (768×1024, default)" },
  { value: "portrait_16_9", label: "Portrait 16:9 (576×1024)" },
  { value: "square_hd", label: "Square HD (1080×1080)" },
  { value: "square", label: "Square (512×512)" },
  { value: "landscape_4_3", label: "Landscape 4:3 (1024×768)" },
  { value: "landscape_16_9", label: "Landscape 16:9 (1024×576)" },
];

export function TaskForm({ open, onOpenChange, initialTask, onSave }: TaskFormProps) {
  const [name, setName] = useState(initialTask?.name ?? "");
  const [description, setDescription] = useState(initialTask?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(initialTask?.status ?? "paused");
  const [cadenceEvery, setCadenceEvery] = useState(initialTask?.cadence.every ?? 1);
  const [cadenceUnit, setCadenceUnit] = useState<"days" | "weeks">(initialTask?.cadence.unit ?? "days");
  const [defaultPostType, setDefaultPostType] = useState<PostType>(initialTask?.defaultPostType ?? "single_image");
  const [defaultImageSize, setDefaultImageSize] = useState(initialTask?.defaultImageSize ?? "portrait_4_3");

  const isEditing = !!initialTask;

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      status,
      scheduledTime: initialTask?.scheduledTime ?? null,
      cadence: { every: cadenceEvery, unit: cadenceUnit },
      defaultPostType,
      defaultImageSize,
      fallbackLocations: initialTask?.fallbackLocations ?? [],
      fallbackNotes: initialTask?.fallbackNotes ?? "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-zinc-800 bg-zinc-900 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">
            {isEditing ? "Edit Task" : "New Task"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-zinc-400">Task Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Daily Beach Post"
              className="mt-1 border-zinc-700 bg-zinc-950 text-zinc-100"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-zinc-400">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this task for?"
              className="mt-1 min-h-[60px] resize-none border-zinc-700 bg-zinc-950 text-zinc-100"
            />
          </div>

          {/* Status + automation mode */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-400">Status</label>
              <div className="mt-1 flex gap-2">
                {(["running", "paused"] as TaskStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                      status === s
                        ? s === "running"
                          ? "bg-emerald-900 text-emerald-300"
                          : "bg-yellow-900 text-yellow-300"
                        : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-400">Automation</label>
              <div className="mt-1 rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                <p className="text-xs font-medium text-zinc-200">Full Auto</p>
                <p className="mt-1 text-[10px] text-zinc-500">
                  Tasks create posts on schedule and the unified runner handles generation and publishing automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Cadence */}
          <div>
            <label className="text-xs font-medium text-zinc-400">Cadence</label>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm text-zinc-400">Every</span>
              <Input
                type="number"
                min={1}
                max={365}
                value={cadenceEvery}
                onChange={(e) => setCadenceEvery(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 border-zinc-700 bg-zinc-950 text-zinc-100"
              />
              <div className="flex gap-2">
                {(["days", "weeks"] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => setCadenceUnit(u)}
                    className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                      cadenceUnit === u
                        ? "bg-zinc-700 text-zinc-100"
                        : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Post type + Image size */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-400">Default Post Type</label>
              <div className="mt-1 flex flex-col gap-1">
                {POST_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDefaultPostType(opt.value)}
                    className={`rounded px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                      defaultPostType === opt.value
                        ? "bg-zinc-700 text-zinc-100"
                        : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-400">Image Size</label>
              <div className="mt-1 flex flex-col gap-1">
                {IMAGE_SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDefaultImageSize(opt.value)}
                    className={`rounded px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                      defaultImageSize === opt.value
                        ? "bg-zinc-700 text-zinc-100"
                        : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {isEditing ? "Save Changes" : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
