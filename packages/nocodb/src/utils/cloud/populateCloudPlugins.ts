import { serverConfig } from 'config'
import S3PluginConfig from '~/plugins/s3';
import SESPluginConfig from '~/plugins/ses';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';

export const populatePluginsForCloud = async ({ ncMeta = Noco.ncMeta }) => {
  if (!serverConfig.s3CloudConfig) {
    throw new Error('S3 env variables not found');
  }

  const s3PluginData = await ncMeta.metaGet2(
    RootScopes.ROOT,
    RootScopes.ROOT,
    MetaTable.PLUGIN,
    {
      title: S3PluginConfig.title,
    },
  );

  if (!s3PluginData && !process.env.NC_LICENSE_KEY)
    throw new Error('S3 plugin not found');

  if (s3PluginData) {
    const s3PluginFromDb = s3PluginData.input
      ? JSON.parse(s3PluginData.input)
      : {};

    const s3PluginFromEnv = {
      access_key: serverConfig.s3CloudConfig.accessKey,
      access_secret: serverConfig.s3CloudConfig.secretKey,
      bucket: serverConfig.s3CloudConfig.bucketName,
      region: serverConfig.s3CloudConfig.region,
      acl: serverConfig.s3CloudConfig.acl,
    };

    const isS3PluginUpdateNeeded = Object.keys(s3PluginFromEnv).some(
      (key) => s3PluginFromDb[key] !== s3PluginFromEnv[key],
    );

    if (isS3PluginUpdateNeeded) {
      await ncMeta.metaUpdate(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.PLUGIN,
        {
          input: JSON.stringify(s3PluginFromEnv),
          active: true,
        },
        s3PluginData.id,
      );
    }
  }

  const sesPluginData = await ncMeta.metaGet2(
    RootScopes.ROOT,
    RootScopes.ROOT,
    MetaTable.PLUGIN,
    {
      title: SESPluginConfig.title,
    },
  );

  if (!sesPluginData && !process.env.NC_LICENSE_KEY) {
    throw new Error('SES plugin not found');
  }

  if (sesPluginData) {
    const sesPluginFromDb = sesPluginData.input
      ? JSON.parse(sesPluginData.input)
      : {};

    const sesPluginFromEnv = {
      access_key: serverConfig.sesConfig.accessKey,
      access_secret: serverConfig.sesConfig.secretKey,
      region: serverConfig.sesConfig.region,
      from: serverConfig.sesConfig.from,
    };

    const isSESPluginUpdateNeeded = Object.keys(sesPluginFromEnv).some(
      (key) => sesPluginFromDb[key] !== sesPluginFromEnv[key],
    );

    if (isSESPluginUpdateNeeded) {
      await ncMeta.metaUpdate(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.PLUGIN,
        {
          input: JSON.stringify(sesPluginFromEnv),
          active: true,
        },
        sesPluginData.id,
      );
    }
  }
};
