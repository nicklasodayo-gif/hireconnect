// The actual toast rendering lives in context/ToastContext.tsx (it owns the
// state), this file just re-exports the hook so `components/ui` remains the
// single place other components import UI primitives from.
export { useToast } from "@/context/ToastContext";
export type { ToastKind } from "@/context/ToastContext";
