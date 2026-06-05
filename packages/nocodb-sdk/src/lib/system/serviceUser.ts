const ServiceUserType = {
  SYSTEM_USER: 'SYSTEM_USER',
  ANONYMOUS_USER: 'ANONYMOUS_USER',
  AUTOMATION_USER: 'AUTOMATION_USER',
  SYNC_USER: 'SYNC_USER',
  WORKFLOW_USER: 'WORKFLOW_USER',
  TRASH_CLEANUP_USER: 'TRASH_CLEANUP_USER',
} as const;

const NOCO_SERVICE_USERS = {
  [ServiceUserType.SYSTEM_USER]: {
    id: 'usrsystem',
    email: 'system@nocodb.com',
    display_name: 'NocoDB System',
    email_verified: true,
  },
  // Anonymous actor for unauthenticated public access (shared form / shared
  // view submissions, shared base). Keeps audits attributable instead of NULL.
  [ServiceUserType.ANONYMOUS_USER]: {
    id: 'usranonymous',
    email: 'anonymous@nocodb.com',
    display_name: 'Anonymous',
    email_verified: true,
  },
  [ServiceUserType.AUTOMATION_USER]: {
    id: 'usrautomation',
    email: 'automation@nocodb.com',
    display_name: 'NocoDB Automation',
    email_verified: true,
  },
  [ServiceUserType.SYNC_USER]: {
    id: 'usrsync',
    email: 'sync-service@nocodb.com',
    display_name: 'NocoDB Sync',
    email_verified: true,
  },
  [ServiceUserType.WORKFLOW_USER]: {
    id: 'usrworkflow',
    email: 'workflow-service@nocodb.com',
    display_name: 'NocoDB Workflow',
    email_verified: true,
  },
  [ServiceUserType.TRASH_CLEANUP_USER]: {
    id: 'usrtrashcleanup',
    email: 'trash-cleanup@nocodb.com',
    display_name: 'NocoDB Trash Cleanup',
    email_verified: true,
  },
} as const;

type ServiceUserKey = keyof typeof NOCO_SERVICE_USERS;

const isServiceUser = (
  user: any,
  serviceType?: ServiceUserKey | ServiceUserKey[]
): boolean => {
  if (!user) return false;

  if (Array.isArray(serviceType)) {
    return serviceType.some((type) => isServiceUser(user, type));
  }

  // If specific service type is provided, check against that service user only
  if (serviceType) {
    const serviceUser = NOCO_SERVICE_USERS[serviceType];
    return user?.email === serviceUser.email || user?.id === serviceUser.id;
  }

  // Otherwise, check against all service users
  return Object.values(NOCO_SERVICE_USERS).some(
    (serviceUser) =>
      user?.email === serviceUser.email || user?.id === serviceUser.id
  );
};

export { ServiceUserType, NOCO_SERVICE_USERS, isServiceUser };
