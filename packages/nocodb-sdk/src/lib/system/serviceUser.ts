const NOCO_SERVICE_USERS = {
  AUTOMATION_USER: {
    id: 'usrautomation',
    email: 'automation@nocodb.com',
    display_name: 'NocoDB Automation',
    email_verified: true,
  },
  SYNC_USER: {
    id: 'usrsync',
    email: 'sync-service@nocodb.com',
    display_name: 'NocoDB Sync',
    email_verified: true,
  },
};

const isAutomationUser = (user: any) => {
  return (
    user.email === NOCO_SERVICE_USERS.AUTOMATION_USER.email ||
    user.id === NOCO_SERVICE_USERS.AUTOMATION_USER.id
  );
};

export { NOCO_SERVICE_USERS, isAutomationUser };
