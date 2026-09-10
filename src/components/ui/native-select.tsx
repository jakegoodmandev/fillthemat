import type * as React from "react";
import { controlClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(controlClass, "bg-background text-foreground", className)}
      {...props}
    />
  );
}

export { NativeSelect };
