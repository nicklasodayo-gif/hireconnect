import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui";

export interface TagInputProps {
  items: (string | { name: string })[];
  onAdd: (value: string) => void;
  placeholder?: string;
}

export function TagInput({ items, onAdd, placeholder }: TagInputProps) {
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => { e.preventDefault(); if (value.trim()) { onAdd(value.trim()); setValue(""); } };
  return (
    <div>
      <div className="pill-row">{items.map((s) => <Badge key={typeof s === "string" ? s : s.name}>{typeof s === "string" ? s : s.name}</Badge>)}</div>
      <form className="inline-add" onSubmit={submit}>
        <input placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="btn subtle">Add</button>
      </form>
    </div>
  );
}
