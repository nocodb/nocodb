export default (roles: string | string[]) => {
  if (typeof roles === 'string') {
    roles = roles.split(',');
  }
  return roles.reduce((acc, role) => {
    acc[role] = true;
    return acc;
  }, {});
};
