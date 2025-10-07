import { MetadataReader, toPassportConfig } from 'passport-saml-metadata';
import { NcError } from '~/helpers/catchError';

export async function parseSamlMetadata(metadataXml) {
  const reader = new MetadataReader(metadataXml);
  const config = toPassportConfig(reader, { multipleCerts: true });

  if (!config.entryPoint) {
    NcError.badRequest('Invalid SAML metadata: missing entryPoint');
  }

  return {
    entityIdFromMeta: reader.entityId,
    identityProviderUrl: config.identityProviderUrl,
    entryPoint: config.entryPoint,
    cert: config.idpCert,
    logoutUrl: config.logoutUrl,
  };
}
