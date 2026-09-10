import type * as React from "react";
import { cn } from "@/lib/utils";

const controlClass =
  "h-11 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:h-9 md:text-sm dark:bg-input/20";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(controlClass, className)}
      {...props}
    />
  );
}

export { controlClass, Input };
