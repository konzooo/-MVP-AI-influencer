"use client";

import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    emojis: [
      "😊","😂","🥰","😍","🤩","😎","🥳","😜","😏","😇","🙂","😉","😋","😘","😁","😆","🤭","😶‍🌫️","🫠","🥹",
    ],
  },
  {
    label: "Hearts",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💖","💗","💓","💞","💕","💝","❣️","💔","🫶","💌","♥️"],
  },
  {
    label: "Hands",
    emojis: ["👋","🤚","🖐️","✋","🤙","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","👍","👎","✊","👊","🙌","👏","🫶"],
  },
  {
    label: "Nature",
    emojis: ["🌸","🌺","🌻","🌹","🌷","🪷","🌿","🍃","🌱","🌴","🌊","🌙","⭐","✨","🔥","💫","❄️","🌈","☀️","🌙"],
  },
  {
    label: "Food",
    emojis: ["🍓","🍒","🍑","🥭","🍍","🍇","🍋","🍰","🧁","🍩","🍫","🍭","☕","🧃","🥂","🍾","🥗","🍜","🍕","🍣"],
  },
  {
    label: "Travel",
    emojis: ["✈️","🌍","🗺️","🏖️","🏝️","🌅","🏙️","🗼","🏔️","⛰️","🚗","🚂","⛵","🎒","📸","🔭","🌃","🌉","🗺️","🧳"],
  },
  {
    label: "Lifestyle",
    emojis: ["💅","👠","👗","💋","🪞","🛁","🧴","💄","🎵","🎶","📱","💻","📸","🎨","🎭","🛍️","🏋️","🧘","🤸","💃"],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault(); // prevent textarea blur
          setOpen((v) => !v);
        }}
        className="flex items-center justify-center rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
        title="Insert emoji"
      >
        <Smile className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute bottom-7 right-0 z-50 w-64 rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl">
          {/* Category tabs */}
          <div className="flex gap-0.5 overflow-x-auto border-b border-zinc-800 px-2 pt-2 scrollbar-none">
            {EMOJI_CATEGORIES.map((cat, i) => (
              <button
                key={cat.label}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setActiveCategory(i); }}
                className={`shrink-0 rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                  activeCategory === i
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Emoji grid */}
          <div className="grid grid-cols-8 gap-0.5 p-2">
            {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(emoji);
                  setOpen(false);
                }}
                className="flex h-7 w-7 items-center justify-center rounded text-base transition-colors hover:bg-zinc-700"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
