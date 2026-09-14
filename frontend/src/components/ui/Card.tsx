import { HTMLAttributes } from "react";
import clsx from "clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export function Card({ className, padded = true, children, ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-2xl bg-white/80 shadow-soft border border-border",
        padded && "p-5 sm:p-6",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
