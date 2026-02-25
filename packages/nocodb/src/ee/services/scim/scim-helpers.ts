import { HttpException } from '@nestjs/common';
import { WorkspaceUserRoles } from 'nocodb-sdk';

// NocoDB SCIM extension schema URIs
export const NOCODB_GROUP_EXTENSION =
  'urn:ietf:params:scim:schemas:extension:nocodb:2.0:Group';

export const NOCODB_USER_EXTENSION =
  'urn:ietf:params:scim:schemas:extension:nocodb:2.0:User';

// Map of SCIM role label → WorkspaceUserRoles enum value
export const SCIM_ROLE_MAP: Record<string, WorkspaceUserRoles> = {
  owner: WorkspaceUserRoles.OWNER,
  creator: WorkspaceUserRoles.CREATOR,
  editor: WorkspaceUserRoles.EDITOR,
  commenter: WorkspaceUserRoles.COMMENTER,
  viewer: WorkspaceUserRoles.VIEWER,
  'no-access': WorkspaceUserRoles.NO_ACCESS,
};

// Reverse map: WorkspaceUserRoles enum → SCIM label for output
export const WORKSPACE_ROLE_TO_LABEL: Record<string, string> = Object.entries(
  SCIM_ROLE_MAP,
).reduce((acc, [label, role]) => ({ ...acc, [role]: label }), {});

/**
 * Extract and validate workspaceRole from a SCIM extension attribute.
 * Works for both User and Group extension schemas.
 *
 * @param scimResource  The incoming SCIM request body
 * @param extensionUri  The extension schema URI to read from
 * @returns The WorkspaceUserRoles enum value, or undefined if not present
 * @throws HttpException 400 if the value is invalid
 */
export function extractWorkspaceRoleFromExtension(
  scimResource: Record<string, unknown>,
  extensionUri: string,
): WorkspaceUserRoles | undefined {
  const extension = scimResource[extensionUri] as
    | { workspaceRole?: string }
    | undefined;
  if (!extension?.workspaceRole) return undefined;

  const role = SCIM_ROLE_MAP[extension.workspaceRole.toLowerCase()];
  if (!role) {
    throw new HttpException(
      {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        scimType: 'invalidValue',
        detail: `Invalid workspaceRole "${
          extension.workspaceRole
        }". Valid values: ${Object.keys(SCIM_ROLE_MAP).join(', ')}`,
        status: '400',
      },
      400,
    );
  }

  return role;
}
