import { createFileRoute } from "@tanstack/react-router";
import { MasterDataManagement } from "@/components/dashboard/MasterDataManagement";
import { CustomerApi } from "@/hooks/use-master-data";

export const Route = createFileRoute("/customer")({
  head: () => ({
    meta: [
      { title: "Customer Management - Sugity Creatives" },
      { name: "description", content: "Kelola data customer" },
    ],
  }),
  component: () => (
    <MasterDataManagement
      title="Customer"
      description="Kelola daftar customer untuk pengiriman part."
      api={CustomerApi}
    />
  ),
});
