export const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  FACTORY_OPERATOR: 'FACTORY_OPERATOR',
  CONSULTANT: 'CONSULTANT',
  REGULATOR: 'REGULATOR',
});

export const ROLE_LIST = Object.freeze(Object.values(ROLES));

/** Roles a user may choose at public registration. ADMIN is never self-assigned. */
export const SELF_REGISTRABLE_ROLES = Object.freeze([ROLES.FACTORY_OPERATOR, ROLES.CONSULTANT, ROLES.REGULATOR]);

/** Role groups implementing the API contract's authorization rules. */
export const ROLE_GROUPS = Object.freeze({
  MANAGE_CONFIGURATION: [ROLES.ADMIN],
  MANAGE_FACTORIES: [ROLES.ADMIN, ROLES.FACTORY_OPERATOR],
  WRITE_OPERATIONAL_DATA: [ROLES.ADMIN, ROLES.FACTORY_OPERATOR],
  RUN_ANALYSIS: [ROLES.ADMIN, ROLES.FACTORY_OPERATOR, ROLES.CONSULTANT],
  READ: ROLE_LIST,
});

export const ACTIVITY_SOURCES = Object.freeze({
  MANUAL: 'MANUAL',
  CSV: 'CSV',
  SIMULATION: 'SIMULATION',
});
