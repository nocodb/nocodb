import { promisify } from 'util';
import process from 'process';
import crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { parseString } from 'xml2js';
import axios from 'axios';
import libxmljs from 'libxmljs';

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
    if (
      (
        await SSOClient.list({
          // fk_user_id: param.req.user.id,
          type: param.client.type,
        })
      ).length > 0
    ) {
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
        // httpAgent: useAgent(param.metadataUrl, {
        //   stopPortScanningByUrlRedirection: true,
        // }),
        // httpsAgent: useAgent(param.metadataUrl, {
        //   stopPortScanningByUrlRedirection: true,
        // }),
      });
      if (!response.data) NcError.badRequest('Invalid metadata url');

      return response.data;
    } catch (e) {
      // if axios error, throw invalid metadata url error
      if (e.response) NcError.badRequest('Invalid metadata url');
      throw e;
    }
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
              await parse((extractedConfig as SAMLClientConfigType).xml),
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

// metadata parser -https://github.com/mikefowler/node-idp-metadata-parser/tree/master
// todo: move to separate utils file

export async function parse(metadataXml, options: any = {}) {
  return new Promise((resolve) => {
    const { entityId, ssoBinding, sloBinding } = options;

    const doc = libxmljs.parseXml(metadataXml);
    const entityDescriptor = getEntityDescriptor(doc, entityId);
    const idpNameIdFormat = getIdpNameIdFormat(entityDescriptor);
    const singleSignOnServiceUrl = getSingleSignonServiceUrl(
      entityDescriptor,
      ssoBinding,
    );
    const singleLogoutServiceUrl = getSingleLogoutServiceUrl(
      entityDescriptor,
      sloBinding,
    );
    const attributeNames = getAttributeNames(entityDescriptor);
    const certificates = getCertificates(entityDescriptor);
    const certificateMetadata = getCertificateMetadata(certificates);

    const metadata = {
      // idpEntityId: entityDescriptor.getAttribute('entityID').value(),
      // nameIdentifierFormat: idpNameIdFormat,
      // idpSsoTargetUrl: singleSignOnServiceUrl,
      // idpSloTargetUrl: singleLogoutServiceUrl,
      // idpAttributeNames: attributeNames,
      // ...certificateMetadata,

      issuer: entityDescriptor.getAttribute('entityID').value(),
      entryPoint: singleSignOnServiceUrl,
      // encryptionCert,
      cert: certificates?.signing?.[0],
    };

    resolve(metadata);
  });
}

// export function parseRemote(metadataUrl, options = {}) {
//   return requestMetadata(metadataUrl).then((metadata) =>
//     parse(metadata, options),
//   );
// }

const NAMESPACE = {
  md: 'urn:oasis:names:tc:SAML:2.0:metadata',
  NameFormat: 'urn:oasis:names:tc:SAML:2.0:attrname-format:*',
  saml: 'urn:oasis:names:tc:SAML:2.0:assertion',
  ds: 'http://www.w3.org/2000/09/xmldsig#',
};

// export function requestMetadata(uri) {
//   return request({ uri });
// }

function getEntityDescriptorPath(entityId) {
  const path = '//md:EntityDescriptor';

  if (!entityId) {
    return path;
  }

  return `${path}[@entityID="${entityId}"]`;
}

export function getEntityDescriptor(doc, entityId) {
  if (!doc) return null;

  const path = getEntityDescriptorPath(entityId);
  return doc.get(path, NAMESPACE);
}

export function getIdpSsoDescriptor(doc) {
  if (!doc) return null;

  return doc.get('md:IDPSSODescriptor', NAMESPACE);
}

export function getIdpNameIdFormat(doc) {
  if (!doc) return null;

  const node = doc.get('md:IDPSSODescriptor/md:NameIDFormat', NAMESPACE);

  if (node) {
    return node.text();
  }

  return null;
}

function getSingleSignonServiceBinding(doc, bindingPriority) {
  const nodes = doc.find(
    'md:IDPSSODescriptor/md:SingleSignOnService/@Binding',
    NAMESPACE,
  );

  if (bindingPriority) {
    const bindings = nodes.map((node) => node.value());
    return bindingPriority.find((priority) => bindings.includes(priority));
  } else if (nodes.length > 0) {
    return nodes[0].value();
  }

  return null;
}

export function getSingleSignonServiceUrl(doc, bindingPriority) {
  const binding = getSingleSignonServiceBinding(doc, bindingPriority);

  if (!binding) return null;

  const node = doc.get(
    `md:IDPSSODescriptor/md:SingleSignOnService[@Binding="${binding}"]/@Location`,
    NAMESPACE,
  );

  if (node) {
    return node.value();
  }

  return null;
}

function getSingleLogoutServiceBinding(doc, bindingPriority) {
  const nodes = doc.find(
    'md:IDPSSODescriptor/md:SingleLogoutService/@Binding',
    NAMESPACE,
  );

  if (bindingPriority) {
    const bindings = nodes.map((node) => node.value());
    return bindingPriority.find((priority) => bindings.includes(priority));
  } else if (nodes.length > 0) {
    return nodes[0].value();
  }

  return null;
}

export function getSingleLogoutServiceUrl(doc, bindingPriority) {
  const binding = getSingleLogoutServiceBinding(doc, bindingPriority);

  if (!binding) return null;

  const node = doc.get(
    `md:IDPSSODescriptor/md:SingleLogoutService[@Binding="${binding}"]/@Location`,
    NAMESPACE,
  );

  if (node) {
    return node.value();
  }

  return null;
}

export function getAttributeNames(doc) {
  if (!doc) return null;

  const nodes = doc.find('md:IDPSSODescriptor/saml:Attribute/@Name', NAMESPACE);

  if (nodes) {
    return nodes.map((n) => n.value());
  }

  return null;
}

export function getCertificates(doc) {
  const signingNodes = doc.find(
    'md:IDPSSODescriptor/md:KeyDescriptor[not(contains(@use, "encryption"))]/ds:KeyInfo/ds:X509Data/ds:X509Certificate',
    NAMESPACE,
  );

  const encryptionNodes = doc.find(
    'md:IDPSSODescriptor/md:KeyDescriptor[not(contains(@use, "signing"))]/ds:KeyInfo/ds:X509Data/ds:X509Certificate',
    NAMESPACE,
  );

  let certs;

  if (signingNodes.length > 0 || encryptionNodes.length > 0) {
    certs = {
      signing: [],
      encryption: [],
    };

    if (signingNodes.length > 0) {
      signingNodes.forEach((node) => {
        certs.signing.push(node.text());
      });
    }

    if (encryptionNodes.length > 0) {
      encryptionNodes.forEach((node) => {
        certs.encryption.push(node.text());
      });
    }
  }

  return certs;
}

function getCertificateFingerprint(certificate, _) {
  if (!certificate) return null;

  const shasum = crypto.createHash('sha1');
  const der = Buffer.from(certificate, 'base64').toString('binary');
  shasum.update(der);

  return shasum.digest('hex');
}

export function getCertificateMetadata(certificates, fingerprintAlgorithm?) {
  if (!certificates) return null;

  const { signing: signingCerts, encryption: encryptionCerts } = certificates;

  const certCount = signingCerts.length + encryptionCerts.length;

  const hasTwoMatchingCerts =
    signingCerts.length === 1 &&
    encryptionCerts.length === 1 &&
    signingCerts[0] === encryptionCerts[0];

  if (certCount === 1 || hasTwoMatchingCerts) {
    const idpCert = signingCerts ? signingCerts[0] : encryptionCerts[0];
    const idpCertFingerprint = getCertificateFingerprint(
      idpCert,
      fingerprintAlgorithm,
    );

    return { idpCert, idpCertFingerprint };
  }

  return {
    idpCertMulti: certificates,
  };
}
