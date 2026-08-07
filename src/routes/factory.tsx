import { createFileRoute } from "@tanstack/react-router";
import { MasterDataManagement } from "@/components/dashboard/MasterDataManagement";
import { FactoryApi } from "@/hooks/use-master-data";

export const Route = createFileRoute("/factory")({
  head: () => ({
    meta: [
      { title: "Factory Management - Sugity Creatives" },
      { name: "description", content: "Kelola data factory origin" },
    ],
  }),
  component: () => (
    <MasterDataManagement
      title="Factory Origin"
      description="Kelola daftar pabrik/factory asal untuk part dan pembuatan QR code."
      api={FactoryApi}
    />
  ),
});
