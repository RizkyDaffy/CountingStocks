import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export type MasterDataItem = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
};

function createMasterDataHooks(endpoint: string, queryKey: string) {
  return {
    useGetAll: () =>
      useQuery({
        queryKey: [queryKey],
        queryFn: () => fetchApi<MasterDataItem[]>(endpoint),
      }),

    useCreate: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (name: string) =>
          fetchApi<MasterDataItem>(endpoint, {
            method: "POST",
            body: JSON.stringify({ name }),
          }),
        onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
      });
    },

    useUpdate: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: ({ id, name }: { id: number; name: string }) =>
          fetchApi<MasterDataItem>(`${endpoint}/${id}`, {
            method: "PUT",
            body: JSON.stringify({ name }),
          }),
        onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
      });
    },

    useDelete: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (id: number) =>
          fetchApi<{ success: true }>(`${endpoint}/${id}`, {
            method: "DELETE",
          }),
        onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
      });
    },
  };
}

export const CategoryApi = createMasterDataHooks("/categories", "categories");
export const ModelApi = createMasterDataHooks("/models", "models");
export const CustomerApi = createMasterDataHooks("/customers", "customers");
export const FactoryApi = createMasterDataHooks("/factories", "factories");
