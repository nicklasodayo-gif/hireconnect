import { forwardRef, type ReactNode, type SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ label, id, className = "", children, ...rest }, ref) => {
  const selectEl = <select ref={ref} id={id} className={className} {...rest}>{children}</select>;
  if (!label) return selectEl;
  return <label htmlFor={id}>{label}{selectEl}</label>;
});
Select.displayName = "Select";
