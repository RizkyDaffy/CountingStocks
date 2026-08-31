export function normalizeRole(role: string): string {
  return role === "viewer" ? "usertv" : role;
}
