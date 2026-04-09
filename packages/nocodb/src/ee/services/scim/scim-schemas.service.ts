import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ScimSchemasService {
  protected logger = new Logger(ScimSchemasService.name);

  constructor() {}

  /**
   * Returns SCIM 2.0 Schema definitions per RFC 7643 Section 7
   * Defines the structure of User and Group resources
   */
  async getSchemas() {
    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: 4,
      startIndex: 1,
      itemsPerPage: 4,
      Resources: [
        // User Schema
        {
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:Schema'],
          id: 'urn:ietf:params:scim:schemas:core:2.0:User',
          name: 'User',
          description: 'User Account',
          attributes: [
            {
              name: 'userName',
              type: 'string',
              required: true,
              caseExact: false,
              mutability: 'readWrite',
              returned: 'default',
              uniqueness: 'server',
            },
            {
              name: 'name',
              type: 'complex',
              required: false,
              mutability: 'readWrite',
              returned: 'default',
              subAttributes: [
                {
                  name: 'formatted',
                  type: 'string',
                  required: false,
                  mutability: 'readWrite',
                  returned: 'default',
                },
                {
                  name: 'givenName',
                  type: 'string',
                  required: false,
                  mutability: 'readWrite',
                  returned: 'default',
                },
                {
                  name: 'familyName',
                  type: 'string',
                  required: false,
                  mutability: 'readWrite',
                  returned: 'default',
                },
              ],
            },
            {
              name: 'displayName',
              type: 'string',
              required: false,
              mutability: 'readWrite',
              returned: 'default',
            },
            {
              name: 'emails',
              type: 'complex',
              multiValued: true,
              required: true,
              mutability: 'readWrite',
              returned: 'default',
              subAttributes: [
                {
                  name: 'value',
                  type: 'string',
                  required: true,
                  mutability: 'readWrite',
                  returned: 'default',
                },
                {
                  name: 'type',
                  type: 'string',
                  required: false,
                  mutability: 'readWrite',
                  returned: 'default',
                },
                {
                  name: 'primary',
                  type: 'boolean',
                  required: false,
                  mutability: 'readWrite',
                  returned: 'default',
                },
              ],
            },
            {
              name: 'active',
              type: 'boolean',
              required: false,
              mutability: 'readWrite',
              returned: 'default',
            },
            {
              name: 'externalId',
              type: 'string',
              required: false,
              caseExact: false,
              mutability: 'readWrite',
              returned: 'default',
            },
          ],
          meta: {
            resourceType: 'Schema',
            location:
              '/scim/v2/Schemas/urn:ietf:params:scim:schemas:core:2.0:User',
          },
        },
        // Group Schema
        {
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:Schema'],
          id: 'urn:ietf:params:scim:schemas:core:2.0:Group',
          name: 'Group',
          description: 'Group',
          attributes: [
            {
              name: 'displayName',
              type: 'string',
              required: true,
              caseExact: false,
              mutability: 'readWrite',
              returned: 'default',
            },
            {
              name: 'members',
              type: 'complex',
              multiValued: true,
              required: false,
              mutability: 'readWrite',
              returned: 'default',
              subAttributes: [
                {
                  name: 'value',
                  type: 'string',
                  required: true,
                  mutability: 'readWrite',
                  returned: 'default',
                },
                {
                  name: '$ref',
                  type: 'reference',
                  required: false,
                  mutability: 'readWrite',
                  returned: 'default',
                },
                {
                  name: 'type',
                  type: 'string',
                  required: false,
                  mutability: 'readWrite',
                  returned: 'default',
                },
              ],
            },
            {
              name: 'externalId',
              type: 'string',
              required: false,
              caseExact: false,
              mutability: 'readWrite',
              returned: 'default',
            },
          ],
          meta: {
            resourceType: 'Schema',
            location:
              '/scim/v2/Schemas/urn:ietf:params:scim:schemas:core:2.0:Group',
          },
        },
        // NocoDB User Extension Schema
        {
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:Schema'],
          id: 'urn:ietf:params:scim:schemas:extension:nocodb:2.0:User',
          name: 'NocoDB User Extension',
          description:
            'NocoDB-specific extension attributes for User resources, including org role assignment',
          attributes: [
            {
              name: 'orgRole',
              type: 'string',
              required: false,
              caseExact: false,
              mutability: 'readWrite',
              returned: 'default',
              description:
                'The org-level role assigned to this user. Valid values: creator, viewer',
              canonicalValues: ['creator', 'viewer'],
            },
          ],
          meta: {
            resourceType: 'Schema',
            location:
              '/scim/v2/Schemas/urn:ietf:params:scim:schemas:extension:nocodb:2.0:User',
          },
        },
      ],
    };
  }
}
