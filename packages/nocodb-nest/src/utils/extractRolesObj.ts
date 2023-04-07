export default (roles: string | string[]) => {
  if(!roles) return {};

  if(typeof roles === 'object' && !Array.isArray(roles)) return roles;

  if (typeof roles === 'string') {
    roles = roles.split(',');
  }
  return roles.reduce((acc, role) => {
    acc[role] = true;
    return acc;
  }, {});
};
