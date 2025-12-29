const ServiceUserType = {
  AUTOMATION_USER: 'AUTOMATION_USER',
  SYNC_USER: 'SYNC_USER',
  WORKFLOW_USER: 'WORKFLOW_USER',
} as const;

const NOCO_SERVICE_USERS = {
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
