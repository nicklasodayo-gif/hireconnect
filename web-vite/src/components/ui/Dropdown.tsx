import { useEffect, useRef, useState, type ReactNode } from "react";

export interface DropdownItem { label: string; onClick: () => void; danger?: boolean }

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
}

export function Dropdown({ trigger, items }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="dropdown" ref={ref}>
      <button className="dropdown-trigger" onClick={() => setOpen((o) => !o)}>{trigger}</button>
      {open && (
        <div className="dropdown-menu">
          {items.map((item) => (
            <button key={item.label} className={`dropdown-item ${item.danger ? "danger" : ""}`} onClick={() => { item.onClick(); setOpen(false); }}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
