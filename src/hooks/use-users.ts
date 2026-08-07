import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";

export type AppUser = {
  id: number;
  username: string;
  nik: string;
  role: "admin" | "operator" | "usertv";
  tv_factory?: string;
  tv_shift?: "A" | "B";
  tv_theme?: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
};

export type CreateUserPayload = {
  username: string;
  nik?: string;
  password?: string;
  role: "admin" | "operator" | "usertv";
  tv_factory?: string;
  tv_shift?: "A" | "B";
  tv_theme?: string;
  status: "active" | "inactive";
};

function authFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  return fetchApi<T>(endpoint, {
    ...options,
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      ...options.headers,
    },
  });
}

export function useUsers(search = "") {
  return useQuery({
    queryKey: ["users", search],
    queryFn: () =>
      authFetch<AppUser[]>(`/users${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    staleTime: 1000 * 30,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) =>
      authFetch<AppUser>("/users", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: CreateUserPayload & { id: number }) =>
      authFetch<AppUser>(`/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      authFetch<{ message: string }>(`/users/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
