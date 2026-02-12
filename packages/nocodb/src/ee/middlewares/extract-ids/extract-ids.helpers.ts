import type { OrgUserRoles } from 'nocodb-sdk';

// Re-export shared personal view helpers from CE
export {
  checkIsPersonalViewOwner,
  editorPersonalViewOnlyPermissions,
  markPersonalViewIfNeeded,
  personalViewOwnerAllowedPermissions,
  VIEW_KEY,
  viewOperationsExcludedFromPersonalViewCheck,
} from 'src/middlewares/extract-ids/extract-ids.helpers';

export const beforeAclValidationHook = async (_param: {
  req: any;
  permissionName: string;
  allowedRoles: (OrgUserRoles | string)[];
  scope: string;
}) => {
  // do nothing
};
