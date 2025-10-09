import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

import { useAgent } from 'request-filtering-agent';
import {
  GoogleClientConfigType, NcBaseError,
  OpenIDClientConfigType,
  SAMLClientConfigType,
  SSOClientType,
} from 'nocodb-sdk'
import SSOClient from '~/models/SSOClient';
import { NcError } from '~/helpers/catchError';
import { validatePayload } from '~/helpers';
import { extractProps } from '~/helpers/extractProps';
import { parseSamlMetadata } from '~/utils/saml';
import { Domain } from '~/models';

@Injectable()
export class SSOClientService {
  protected logger = new Logger(SSOClientService.name);
  constructor() {}

  async clientAdd(param: {
    client: SSOClientType;
    req: any;
    orgId?: string;
    workspaceId?: string;
  }) {
    // limit to 1 client for now
    if (
      (
        await SSOClient.list({
          type: param.client.type,
          orgId: param.orgId,
          workspaceId: param.workspaceId,
        })
      ).length > 0
    ) {
      NcError.notAllowed('Only one client is allowed for now');
    }

    // skip validation if deleted is true which is used for precreate for UI
    if (param.client['deleted']) {
      param.client = extractProps(param.client, [
        'deleted',
        'title',
        'type',
        'enabled',
      ]);
    } else {
      // validate client
      validatePayload(
        'swagger.json#/components/schemas/SSOClient',
        param.client,
      );

      param.client.config = await this.validateAndExtractConfig(param);
    }
    // add client
    const client = await SSOClient.insert({
      ...param.client,
      fk_user_id: param.req.user.id,
      fk_org_id: param.orgId,
      fk_workspace_id: param.workspaceId,
    });

    return client;
  }

  async clientUpdate(param: {
    clientId: string;
    client: SSOClientType;
    req: any;
    orgId?: string;
    workspaceId?: string;
  }) {
    // get existing client
    const oldClient = await SSOClient.get(param.clientId);

    this.validateClient(param, oldClient);

    param.client.config = await this.validateAndExtractConfig({
      oldClient,
      client: param.client,
      req: param.req,
    });

    if (param.client.config === undefined || param.client.config === null) {
      delete param.client.config;
    }

    // update client
    const client = await SSOClient.update(param.clientId, {
      ...param.client,
      deleted: false,
    });

    return client;
  }

  async clientDelete(param: {
    clientId: string;
    req: any;
    orgId?: string;
    workspaceId?: string;
  }) {
    const client = await SSOClient.get(param.clientId);
    this.validateClient(param, client);
    // delete client
    const res = await SSOClient.delete(param.clientId);

    return res;
  }

  private validateClient(
    param: { orgId?: string; workspaceId?: string },
    client: SSOClient,
  ) {
    if (param.orgId && param.orgId !== client.fk_org_id) {
      NcError.notAllowed('Client does not belong to this org');
    } else if (
      param.workspaceId &&
      param.workspaceId !== client.fk_workspace_id
    ) {
      NcError.notAllowed('Client does not belong to this workspace');
    }
  }

  async clientList(param: { req: any; orgId?: string; workspaceId?: string }) {
    // list clients
    const clients = await SSOClient.list({
      orgId: param.orgId,
      workspaceId: param.workspaceId,
    });

    return clients;
  }

  async readSamlMetadata(param: { metadataUrl: string }) {
    try {
      const response = await axios(
        param.metadataUrl,
        process.env.NODE_ENV !== 'test'
          ? {
              httpAgent: useAgent(param.metadataUrl, {
                stopPortScanningByUrlRedirection: true,
              }),
              httpsAgent: useAgent(param.metadataUrl, {
                stopPortScanningByUrlRedirection: true,
              }),
            }
          : {},
      );

      if (!response.data) NcError.badRequest('Invalid metadata url');

      return response.data;
    } catch (e) {
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      // if axios error, throw invalid metadata url error
      if (e.response) NcError.badRequest('Invalid metadata url');
      this.logger.error('Failed to read saml metadata', e);
      NcError.internalServerError('Failed to read saml metadata');
    }
  }

  private async validateAndExtractConfig(param: {
    client: SSOClientType;
    req: any;
    oldClient?: SSOClient;
  }) {
    // validate client
    if (!param.oldClient)
      validatePayload(
        `swagger.json#/components/schemas/${
          param.oldClient ? 'SSOClient' : 'SSOClientReq'
        }`,
        param.client,
      );

    if (!param.client.config) return param.client.config;

    const extractedConfig:
      | SAMLClientConfigType
      | OpenIDClientConfigType
      | GoogleClientConfigType = {
      ...param.client.config,
    };

    // parse and extract metadata from url or xml if saml
    switch ((param.client.type || param.oldClient?.type) as string) {
      case 'saml':
        {
          const config = param.client.config as SAMLClientConfigType;
          if (config.metaDataUrl) {
            (extractedConfig as SAMLClientConfigType).xml =
              await this.readSamlMetadata({
                metadataUrl: config.metaDataUrl,
              });
          }

          if ((extractedConfig as SAMLClientConfigType).xml) {
            try {
              Object.assign(
                extractedConfig,
                await parseSamlMetadata(
                  (extractedConfig as SAMLClientConfigType).xml,
                ),
              );
            } catch (e) {
              this.logger.error(e);
              NcError.badRequest('Invalid metadata xml - parsing failed');
            }
          }

          validatePayload('swagger.json#/components/schemas/SAMLClientConfig', {
            ...param.client.config,
            extractedConfig,
          });
        }
        break;
      case 'openid':
      case 'oidc':
        {
          validatePayload(
            'swagger.json#/components/schemas/OpenIDClientConfig',
            param.client.config,
          );
        }
        break;
      case 'google':
        {
          validatePayload(
            'swagger.json#/components/schemas/GoogleClientConfig',
            param.client.config,
          );
        }
        break;
      default: {
        NcError.badRequest('Invalid client type');
      }
    }

    return extractedConfig;
  }

  async getSsoClientsByDomain(param: { email: string; req: any }) {
    // get clients by domain
    const domain = param.email.split('@');

    const orgDomain = await Domain.getByDomain(domain[1]);

    if (!orgDomain) {
      NcError.badRequest('SSO is not configured for this domain');
    }

    let clients = [];
    if (orgDomain.fk_org_id) {
      clients = await SSOClient.listByOrgId(
        orgDomain.fk_org_id,
        param.req.ncSiteUrl,
      );
    } else if (orgDomain.fk_workspace_id) {
      clients = await SSOClient.listByWorkspaceId(
        orgDomain.fk_workspace_id,
        param.req.ncSiteUrl,
      );
    }

    if (!clients?.length) {
      NcError.badRequest('SSO is not configured for this organization');
    }

    return clients;
  }
}
