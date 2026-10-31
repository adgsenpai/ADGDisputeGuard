"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type Command = { id: string; label: string; hint?: string; run: () => void };

/**
 * ⌘K / Ctrl-K command palette: a quick way to jump between tabs and run common
 * actions. Opens on the keyboard shortcut (or a controlled `open` prop),
 * filters as you type, and supports arrow-key navigation.
 */
export default function CommandPalette({
  open,
  onOpenChange,
  commands,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  commands: Command[];
}) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === "Escape") {
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? commands.filter((c) => c.label.toLowerCase().includes(needle)) : commands;
  }, [q, commands]);

  if (!open) return null;

  function runAt(i: number) {
    const cmd = filtered[i];
    if (cmd) {
      onOpenChange(false);
      cmd.run();
    }
  }

  return (
    <div className="cmdk" role="dialog" aria-modal="true" aria-label="Command palette" onClick={() => onOpenChange(false)}>
      <div className="cmdk__panel" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk__input"
          type="text"
          placeholder="Type a command or page…"
          aria-label="Command palette search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIdx((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              runAt(idx);
            }
          }}
        />
        <ul className="cmdk__list">
          {filtered.map((c, i) => (
            <li
              key={c.id}
              className={`cmdk__item ${i === idx ? "cmdk__item--active" : ""}`}
              onMouseEnter={() => setIdx(i)}
              onClick={() => runAt(i)}
            >
              <span>{c.label}</span>
              {c.hint && <span className="cmdk__hint">{c.hint}</span>}
            </li>
          ))}
          {filtered.length === 0 && <li className="cmdk__empty">No matching commands</li>}
        </ul>
        <div className="cmdk__foot">↑↓ to navigate · Enter to run · Esc to close</div>
      </div>
    </div>
  );
}
