import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export type TaskRow = {
  id: number;
  task_id: string;
  title: string;
  type: "Scan In" | "Scan Out" | "QR Created" | "Audit";
  status: "completed" | "pending" | "failed";
  user: string;
  created_at: string;
  updated_at: string;
};

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: () => fetchApi<TaskRow[]>("/tasks"),
  });
}
