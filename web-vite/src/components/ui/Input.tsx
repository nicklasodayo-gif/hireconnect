import { forwardRef, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, id, className = "", ...rest }, ref) => {
  const inputEl = <input ref={ref} id={id} className={className} {...rest} />;
  if (!label) return inputEl;
  return (
    <label htmlFor={id}>
      {label}
      {inputEl}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
});
Input.displayName = "Input";
