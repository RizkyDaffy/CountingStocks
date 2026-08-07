import * as React from "react";

import { cn } from "@/lib/utils";

const AlertDescription = ({ className, ref, ...props }: React.ComponentProps<"div">) => (
  <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
);
AlertDescription.displayName = "AlertDescription";

export { AlertDescription };
