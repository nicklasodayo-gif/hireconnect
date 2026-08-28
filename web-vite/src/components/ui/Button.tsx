import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "ghost" | "subtle" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  wide?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "subtle", size = "md", wide, className = "", ...rest }, ref) => (
    <button
      ref={ref}
      className={`btn ${variant} ${size === "sm" ? "sm" : size === "lg" ? "huge" : ""} ${wide ? "wide" : ""} ${className}`.trim()}
      {...rest}
    />
  )
);
Button.displayName = "Button";
