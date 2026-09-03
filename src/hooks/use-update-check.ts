import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export type ReleaseInfo = {
  tag: string;
  name: string;
  body: string;
  published_at: string;
  url: string;
};

export type UpdateInfo = {
  current: string;
  latest: string;
  releases: ReleaseInfo[];
};

export function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

export function isUpdateAvailable(info: UpdateInfo | undefined): boolean {
  if (!info || !info.latest) return false;
  return compareSemver(info.latest, info.current) > 0;
}

export function useUpdateCheck() {
  return useQuery({
    queryKey: ["app-releases"],
    queryFn: () => fetchApi<UpdateInfo>("/releases"),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
