import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ScimResourceTypesService {
  protected logger = new Logger(ScimResourceTypesService.name);

  constructor() {}

  /**
   * Returns SCIM 2.0 ResourceTypes per RFC 7644 §4
   * Describes the types of resources available (User, Group)
   */
  async getResourceTypes() {
    const resources = [
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
        id: 'User',
        name: 'User',
        endpoint: '/Users',
        description: 'User Account',
        schema: 'urn:ietf:params:scim:schemas:core:2.0:User',
        schemaExtensions: [
          {
            schema:
              'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User',
            required: false,
          },
        ],
        meta: {
          location: '/scim/v2/ResourceTypes/User',
          resourceType: 'ResourceType',
        },
      },
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
        id: 'Group',
        name: 'Group',
        endpoint: '/Groups',
        description: 'Group',
        schema: 'urn:ietf:params:scim:schemas:core:2.0:Group',
        meta: {
          location: '/scim/v2/ResourceTypes/Group',
          resourceType: 'ResourceType',
        },
      },
    ];

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: resources.length,
      Resources: resources,
    };
  }
}
