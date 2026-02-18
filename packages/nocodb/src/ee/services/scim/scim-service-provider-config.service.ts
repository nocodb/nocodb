import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ScimServiceProviderConfigService {
  protected logger = new Logger(ScimServiceProviderConfigService.name);

  constructor() {}

  /**
   * Returns SCIM 2.0 ServiceProviderConfig per RFC 7643 Section 5
   * This endpoint describes the SCIM capabilities of the provider
   */
  async getServiceProviderConfig() {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      documentationUri: 'https://docs.nocodb.com/scim',
      patch: {
        supported: true,
      },
      bulk: {
        supported: false,
        maxOperations: 0,
        maxPayloadSize: 0,
      },
      filter: {
        supported: true,
        maxResults: 100,
      },
      changePassword: {
        supported: false,
      },
      sort: {
        supported: true,
      },
      etag: {
        supported: false,
      },
      authenticationSchemes: [
        {
          type: 'oauthbearertoken',
          name: 'OAuth Bearer Token',
          description: 'Authentication scheme using the OAuth 2.0 Bearer Token',
          specUri: 'https://tools.ietf.org/html/rfc6750',
          documentationUri: 'https://docs.nocodb.com/scim/authentication',
          primary: true,
        },
      ],
      meta: {
        resourceType: 'ServiceProviderConfig',
        location: '/scim/v2/ServiceProviderConfig',
      },
    };
  }
}
