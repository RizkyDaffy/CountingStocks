import { createFileRoute } from "@tanstack/react-router";
import { MasterDataManagement } from "@/components/dashboard/MasterDataManagement";
import { CategoryApi } from "@/hooks/use-master-data";

export const Route = createFileRoute("/category")({
  head: () => ({
    meta: [
      { title: "Category Management - Sugity Creatives" },
      { name: "description", content: "Kelola data kategori parts" },
    ],
  }),
  component: () => (
    <MasterDataManagement
      title="Category"
      description="Kelola daftar kategori yang dapat dipilih pada saat pembuatan Master Part."
      api={CategoryApi}
    />
  ),
});
