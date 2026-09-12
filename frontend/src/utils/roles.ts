import type { Role } from "@/types/domain"

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  FACTORY_OPERATOR: "Factory operator",
  CONSULTANT: "Sustainability consultant",
  REGULATOR: "Regulator / auditor",
}

/** Mirrors the backend's WRITE_OPERATIONAL_DATA group for UI affordances; the API remains authoritative. */
export const OPERATIONAL_DATA_WRITERS: Role[] = ["ADMIN", "FACTORY_OPERATOR"]

/** Mirrors the backend's RUN_ANALYSIS group (e.g. generating recommendations); the API remains authoritative. */
export const ANALYSIS_RUNNERS: Role[] = ["ADMIN", "FACTORY_OPERATOR", "CONSULTANT"]

/** Roles offered at self-registration (ADMIN is never self-assigned). */
export const SELF_REGISTRABLE_ROLES: Exclude<Role, "ADMIN">[] = ["FACTORY_OPERATOR", "CONSULTANT", "REGULATOR"]
