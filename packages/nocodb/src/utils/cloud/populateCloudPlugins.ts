import S3PluginConfig from '~/plugins/s3';
import SESPluginConfig from '~/plugins/ses';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';

export const populatePluginsForCloud = async ({ ncMeta = Noco.ncMeta }) => {
  if (
    !process.env.NC_CLOUD_S3_ACCESS_KEY ||
    !process.env.NC_CLOUD_S3_ACCESS_SECRET ||
    !process.env.NC_CLOUD_S3_BUCKET_NAME ||
    !process.env.NC_CLOUD_S3_REGION ||
    !process.env.NC_CLOUD_S3_ACL
  ) {
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
      access_key: process.env.NC_CLOUD_S3_ACCESS_KEY,
      access_secret: process.env.NC_CLOUD_S3_ACCESS_SECRET,
      bucket: process.env.NC_CLOUD_S3_BUCKET_NAME,
      region: process.env.NC_CLOUD_S3_REGION,
      acl: process.env.NC_CLOUD_S3_ACL,
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
  // // SES
  // if (
  //   !process.env.NC_CLOUD_SES_ACCESS_KEY ||
  //   !process.env.NC_CLOUD_SES_ACCESS_SECRET ||
  //   !process.env.NC_CLOUD_SES_REGION ||
  //   !process.env.NC_CLOUD_SES_FROM
  // ) {
  //   throw new Error('SES env variables not found');
  // }

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
      access_key: process.env.NC_CLOUD_SES_ACCESS_KEY,
      access_secret: process.env.NC_CLOUD_SES_ACCESS_SECRET,
      region: process.env.NC_CLOUD_SES_REGION,
      from: process.env.NC_CLOUD_SES_FROM,
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
