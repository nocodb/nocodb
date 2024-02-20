import { MetadataReader, toPassportConfig } from 'passport-saml-metadata';

export async function parseSamlMetadata(metadataXml) {
  const reader = new MetadataReader(metadataXml);
  const config = toPassportConfig(reader, { multipleCerts: true });

  if (!config.entryPoint) {
    throw new Error('Invalid SAML metadata: missing entryPoint');
  }

  const metadata = {
    entityIdFromMeta: reader.entityId,
    identityProviderUrl: config.identityProviderUrl,
    entryPoint: config.entryPoint,
    cert: config.cert,
    logoutUrl: config.logoutUrl,
  };

  return metadata;
}
