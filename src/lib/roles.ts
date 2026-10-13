// Realm roles in Keycloak. Each role includes everything below it.
export const ROLES = ["viewer", "editor", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  viewer: "Viewer: sees monitors and incidents",
  editor: "Editor: manages monitors, incidents and status pages",
  admin: "Admin: also manages alert channels",
};

// The highest Pulseboard role in a token's role list, or null when the user has none.
export function highestRole(roles: readonly string[]): Role | null {
  for (const role of [...ROLES].reverse()) if (roles.includes(role)) return role;
  return null;
}

export function hasRole(role: Role | null, required: Role): boolean {
  return role !== null && ROLES.indexOf(role) >= ROLES.indexOf(required);
}
