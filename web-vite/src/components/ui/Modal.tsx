import type { ReactNode } from "react";

export interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}

export function Modal({ title, onClose, children, width }: ModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" style={width ? { maxWidth: width } : undefined} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Close">×</button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// Alias: the design system uses one modal primitive for both "modal" and
// "dialog" naming — kept as a re-export so either import name works.
export const Dialog = Modal;

export interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel = "Confirm", danger, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onClose} width="420px">
      <p>{message}</p>
      <div className="form-row">
        <button className="btn ghost wide" onClick={onClose}>Cancel</button>
        <button className={`btn wide ${danger ? "danger" : "primary"}`} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
