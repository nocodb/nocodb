import type { OrgUserRoles } from 'nocodb-sdk';

export const beforeAclValidationHook = async (_param: {
  req: any;
  permissionName: string;
  allowedRoles: (OrgUserRoles | string)[];
  scope: string;
}) => {
  // do nothing
};
