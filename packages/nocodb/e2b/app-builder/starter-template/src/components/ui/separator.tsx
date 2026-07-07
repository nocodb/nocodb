import * as React from "react";
import { cn } from "@/lib/utils";

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<"div"> & {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}) {
  return (
    <div
      data-slot="separator-root"
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        "bg-border shrink-0 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full",
        orientation === "horizontal"
          ? "h-px w-full"
          : "h-full w-px",
        className
      )}
      {...props}
    />
  );
}

export { Separator };
