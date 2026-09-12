import type { Role } from "@/types/domain"

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  FACTORY_OPERATOR: "Factory operator",
  CONSULTANT: "Sustainability consultant",
  REGULATOR: "Regulator / auditor",
}

/** Roles offered at self-registration (ADMIN is never self-assigned). */
export const SELF_REGISTRABLE_ROLES: Exclude<Role, "ADMIN">[] = ["FACTORY_OPERATOR", "CONSULTANT", "REGULATOR"]
