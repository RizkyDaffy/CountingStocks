import { createFileRoute } from "@tanstack/react-router";
import { MasterDataManagement } from "@/components/dashboard/MasterDataManagement";
import { ModelApi } from "@/hooks/use-master-data";

export const Route = createFileRoute("/model")({
  head: () => ({
    meta: [
      { title: "Model Management - Sugity Creatives" },
      { name: "description", content: "Kelola data model parts" },
    ],
  }),
  component: () => (
    <MasterDataManagement
      title="Model"
      description="Kelola daftar model mesin atau kendaraan."
      api={ModelApi}
    />
  ),
});
