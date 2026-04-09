import { HttpException } from '@nestjs/common';
import { EnterpriseOrgUserRoles } from 'nocodb-sdk';

// NocoDB SCIM extension schema URIs
export const NOCODB_GROUP_EXTENSION =
  'urn:ietf:params:scim:schemas:extension:nocodb:2.0:Group';

export const NOCODB_USER_EXTENSION =
  'urn:ietf:params:scim:schemas:extension:nocodb:2.0:User';

// Map of SCIM role label → EnterpriseOrgUserRoles enum value
export const SCIM_ORG_ROLE_MAP: Record<string, EnterpriseOrgUserRoles> = {
  creator: EnterpriseOrgUserRoles.CREATOR,
  viewer: EnterpriseOrgUserRoles.VIEWER,
};

// Reverse map: EnterpriseOrgUserRoles enum → SCIM label for output
export const ORG_ROLE_TO_LABEL: Record<string, string> = Object.entries(
  SCIM_ORG_ROLE_MAP,
).reduce((acc, [label, role]) => ({ ...acc, [role]: label }), {});

/**
 * Extract and validate orgRole from a SCIM extension attribute.
 *
 * @param scimResource  The incoming SCIM request body
 * @param extensionUri  The extension schema URI to read from
 * @returns The EnterpriseOrgUserRoles enum value, or undefined if not present
 * @throws HttpException 400 if the value is invalid
 */
export function extractOrgRoleFromExtension(
  scimResource: Record<string, unknown>,
  extensionUri: string,
): EnterpriseOrgUserRoles | undefined {
  const extension = scimResource[extensionUri] as
    | { orgRole?: string }
    | undefined;
  if (!extension?.orgRole) return undefined;

  const role = SCIM_ORG_ROLE_MAP[extension.orgRole.toLowerCase()];
  if (!role) {
    throw new HttpException(
      {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        scimType: 'invalidValue',
        detail: `Invalid orgRole "${
          extension.orgRole
        }". Valid values: ${Object.keys(SCIM_ORG_ROLE_MAP).join(', ')}`,
        status: '400',
      },
      400,
    );
  }

  return role;
}
