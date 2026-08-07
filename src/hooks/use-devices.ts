import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export type DeviceRow = {
  id: number;
  device_code: string | null;
  name: string;
  model: string;
  type: "phone" | "tablet";
  status: "online" | "offline";
  battery: number;
  location: string;
  device_role: "IN" | "OUT";
  active_status: "active" | "inactive";
  last_sync: string;
  created_at: string;
};

export type CreateDevicePayload = {
  device_code: string;
  name: string;
  location?: string;
  device_role: "IN" | "OUT";
  pin: string;
  model?: string;
  type?: "phone" | "tablet";
  active_status?: "active" | "inactive";
};

export function useDevices() {
  return useQuery({
    queryKey: ["devices"],
    queryFn: () => fetchApi<DeviceRow[]>("/devices"),
    refetchInterval: 30000,
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDevicePayload) =>
      fetchApi<DeviceRow>("/devices", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}

export function useUpdateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CreateDevicePayload> }) =>
      fetchApi<DeviceRow>(`/devices/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}

export function useDeleteDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchApi<{ message: string }>(`/devices/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}
