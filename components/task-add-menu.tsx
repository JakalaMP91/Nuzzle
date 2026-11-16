"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TaskAddMenu({ onTask, onLane }: { onTask: () => void; onLane: () => void }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const openedByHover = useRef(false);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return <div ref={container} className="task-add-menu"
    onPointerEnter={event => { if (event.pointerType === "mouse") { openedByHover.current = true; setOpen(true); } }}
    onPointerLeave={event => { if (event.pointerType === "mouse") { openedByHover.current = false; setOpen(false); } }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}
    onKeyDown={event => { if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); trigger.current?.focus(); } }}>
    <Button ref={trigger} type="button" className="fab task-add-menu__trigger" aria-expanded={open} aria-controls={open ? "task-add-options" : undefined} onClick={event => { if (event.detail !== 0 && openedByHover.current) { openedByHover.current = false; setOpen(true); } else setOpen(value => !value); }}><Plus />Element hinzufügen</Button>
    {open && <div className="task-add-menu__options" id="task-add-options">
      <Button type="button" variant="outline" onClick={() => { setOpen(false); onTask(); }}><Plus />Aufgabe hinzufügen</Button>
      <Button type="button" variant="outline" onClick={() => { setOpen(false); onLane(); }}><Plus />Bereich hinzufügen</Button>
    </div>}
  </div>;
}
