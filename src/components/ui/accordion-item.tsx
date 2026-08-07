import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";

import { cn } from "@/lib/utils";

const AccordionItem = ({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) => (
  <AccordionPrimitive.Item ref={ref} className={cn("border-b", className)} {...props} />
);
AccordionItem.displayName = "AccordionItem";

export { AccordionItem };
