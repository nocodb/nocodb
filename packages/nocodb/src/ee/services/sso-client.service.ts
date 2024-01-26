import { promisify } from 'util';
import process from 'process';
import { Injectable } from '@nestjs/common';
import { parseString } from 'xml2js';
import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import type {
  OpenIDClientConfigType,
  SAMLClientConfigType,
  SSOClientType,
} from 'nocodb-sdk';
import SSOClient from '~/models/SSOClient';
import { NcError } from '~/helpers/catchError';
import { validatePayload } from '~/helpers';

const parseStringPromise = promisify(parseString);

@Injectable()
export class SSOClientService {
  constructor() {}

  async clientAdd(param: { client: SSOClientType; req: any }) {
    // check if user is admin

    // limit to 1 client for now
    if((await SSOClient.list({
      // fk_user_id: param.req.user.id,
      type: param.client.type,
    })).length > 0) {
      NcError.notAllowed('Only one client is allowed for now');
    }

    // validate client
    validatePayload('swagger.json#/components/schemas/SSOClient', param.client);

    param.client.config = await this.validateAndExtractConfig(param);

    // add client
    const client = await SSOClient.insert({
      ...param.client,
      // TODO: userId is undefined
      // fk_user_id: param.req.user.id,
      fk_user_id: 'usuejdyjt1xc15m6',
    });

    return client;
  }

  async clientUpdate(param: {
    clientId: string;
    client: SSOClientType;
    req: any;
  }) {
    // get existing client
    const oldClient = await SSOClient.get(param.clientId);

    param.client.config = await this.validateAndExtractConfig({
      oldClient,
      client: param.client,
      req: param.req,
    });

    // update client
    const client = await SSOClient.update(param.clientId, param.client);

    return client;
  }

  async clientDelete(param: { clientId: string; req: any }) {
    // check if user is admin

    // delete client
    const client = await SSOClient.delete(param.clientId);

    return client;
  }

  async clientList(_param: { req: any }) {
    // check if user is admin

    // list clients
    const clients = await SSOClient.list({
      // fk_user_id: param.req.user.id,
    });

    return clients;
  }

  async readSamlMetadata(param: { metadataUrl: string }) {
    try {
      const response = await axios(param.metadataUrl, {
        httpAgent: useAgent(param.metadataUrl, {
          stopPortScanningByUrlRedirection: true,
        }),
        httpsAgent: useAgent(param.metadataUrl, {
          stopPortScanningByUrlRedirection: true,
        }),
      });
      if (!response.data) NcError.badRequest('Invalid metadata url');

      return response.data;
    } catch (e) {
      // if axios error, throw invalid metadata url error
      if (e.response) NcError.badRequest('Invalid metadata url');
      throw e;
    }
  }

  async extractSamlClientConfigFromXml(param: { metadata: string }) {
    const result: any = await parseStringPromise(param.metadata);

    // Access the SAML metadata properties in the result object
    const issuer = result.EntityDescriptor.$.entityID;
    const entryPoint =
      result.EntityDescriptor.IDPSSODescriptor.SingleSignOnService.$.Location;

    // Access the signing and encryption certificates
    const cert: string =
      result.EntityDescriptor.IDPSSODescriptor.KeyDescriptor[0].KeyInfo.X509Data
        .X509Certificate;
    const encryptionCert: string =
      result.EntityDescriptor.IDPSSODescriptor.KeyDescriptor[1].KeyInfo.X509Data
        .X509Certificate;

    return {
      issuer,
      entryPoint,
      encryptionCert,
      cert,
    };
  }


  private async validateAndExtractConfig(param: {
    client: SSOClientType;
    req: any;
    oldClient?: SSOClient;
  }) {
    // validate client
    validatePayload(
      `swagger.json#/components/schemas/${
        param.oldClient ? 'SSOClient' : 'SSOClientReq'
      }`,
      param.client,
    );

    if (!param.client.config) return param.client.config;

    const extractedConfig: SAMLClientConfigType | OpenIDClientConfigType = {
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

        if (config.xml) {
          Object.assign(
            extractedConfig,
            await this.extractSamlClientConfigFromXml({
              metadata: (extractedConfig as SAMLClientConfigType).xml,
            }),
          );
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
      default: {
        NcError.badRequest('Invalid client type');
      }
    }

    return extractedConfig;
  }

}
