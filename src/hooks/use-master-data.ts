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

export type ScItem = {
  id: string;
  sc_id: string;
  created_at: string;
  updated_at: string;
};

export const ScApi = {
  useGetAll: () =>
    useQuery({
      queryKey: ["sc"],
      queryFn: () => fetchApi<ScItem[]>("/sc"),
    }),

  useCreate: () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (data: { id?: string; sc_id?: string }) =>
        fetchApi<ScItem>("/sc", {
          method: "POST",
          body: JSON.stringify(data),
        }),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["sc"] }),
    });
  },

  useUpdate: () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, sc_id }: { id: string; sc_id: string }) =>
        fetchApi<ScItem>(`/sc/${id}`, {
          method: "PUT",
          body: JSON.stringify({ sc_id }),
        }),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["sc"] }),
    });
  },

  useDelete: () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (id: string) =>
        fetchApi<{ success: true }>(`/sc/${id}`, { method: "DELETE" }),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["sc"] }),
    });
  },
};

export type FactoryItem = {
  uuid: string;
  factory_name: string;
  factory_code: string;
  factory_sc: string;
  created_at: string;
  updated_at: string;
};

export const FactoryApi = {
  useGetAll: () =>
    useQuery({
      queryKey: ["factories"],
      queryFn: () => fetchApi<FactoryItem[]>("/factories"),
    }),

  useCreate: () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (data: {
        factory_name: string;
        factory_code?: string;
        factory_sc?: string;
      }) =>
        fetchApi<FactoryItem>("/factories", {
          method: "POST",
          body: JSON.stringify(data),
        }),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["factories"] }),
    });
  },

  useUpdate: () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({
        uuid,
        ...data
      }: {
        uuid: string;
        factory_name: string;
        factory_code?: string;
        factory_sc?: string;
      }) =>
        fetchApi<FactoryItem>(`/factories/${uuid}`, {
          method: "PUT",
          body: JSON.stringify(data),
        }),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["factories"] }),
    });
  },

  useDelete: () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (uuid: string) =>
        fetchApi<{ success: true }>(`/factories/${uuid}`, { method: "DELETE" }),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["factories"] }),
    });
  },
};
