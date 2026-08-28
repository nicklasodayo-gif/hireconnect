import { useEffect, useState } from "react";

export function useHashRoute(): string {
  const [hash, setHash] = useState<string>(() => window.location.hash.slice(1) || "/");
  useEffect(() => {
    const onChange = () => setHash(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

export function navigate(path: string) {
  window.location.hash = path;
}

export interface ParsedRoute {
  segments: string[];
  query: Record<string, string>;
}

export function parseRoute(hash: string): ParsedRoute {
  const [pathPart, queryPart] = hash.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(queryPart || ""));
  return { segments, query };
}
