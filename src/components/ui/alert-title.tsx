import * as React from "react";

import { cn } from "@/lib/utils";

const AlertTitle = ({ className, children, ref, ...props }: React.ComponentProps<"h5">) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  >
    {children}
  </h5>
);
AlertTitle.displayName = "AlertTitle";

export { AlertTitle };
