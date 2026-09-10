import type * as React from "react";
import { controlClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(controlClass, "h-auto min-h-20 resize-y py-2", className)}
      {...props}
    />
  );
}

export { Textarea };
