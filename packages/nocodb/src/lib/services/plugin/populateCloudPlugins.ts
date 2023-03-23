import { MetaTable } from '../../utils/globals';
import S3PluginConfig from '../../plugins/s3';
import SESPluginConfig from '../../plugins/ses';
import Noco from '../..';

export const populatePluginsForCloud = async ({ ncMeta = Noco.ncMeta }) => {
  if (
    !process.env.NC_CLOUD_S3_ACCESS_KEY ||
    !process.env.NC_CLOUD_S3_ACCESS_SECRET ||
    !process.env.NC_CLOUD_S3_BUCKET_NAME ||
    !process.env.NC_CLOUD_S3_REGION
  ) {
    throw new Error('S3 env variables not found');
  }

  const s3PluginData = await ncMeta.metaGet2(null, null, MetaTable.PLUGIN, {
    title: S3PluginConfig.title,
  });

  if (s3PluginData) {
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.PLUGIN,
      {
        input: JSON.stringify({
          access_key: process.env.NC_CLOUD_S3_ACCESS_KEY,
          access_secret: process.env.NC_CLOUD_S3_ACCESS_SECRET,
          bucket: process.env.NC_CLOUD_S3_BUCKET_NAME,
          region: process.env.NC_CLOUD_S3_REGION,
        }),
        active: true,
      },
      s3PluginData.id
    );
  } else {
    throw new Error('S3 plugin not found');
  }

  // SES
  if (
    !process.env.NC_CLOUD_SES_ACCESS_KEY ||
    !process.env.NC_CLOUD_SES_ACCESS_SECRET ||
    !process.env.NC_CLOUD_SES_REGION ||
    !process.env.NC_CLOUD_SES_FROM
  ) {
    throw new Error('SES env variables not found');
  }

  const sesPluginData = await ncMeta.metaGet2(null, null, MetaTable.PLUGIN, {
    title: SESPluginConfig.title,
  });

  if (!sesPluginData) throw new Error('SES plugin not found');

  if (sesPluginData) {
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.PLUGIN,
      {
        input: JSON.stringify({
          access_key: process.env.NC_CLOUD_SES_ACCESS_KEY,
          access_secret: process.env.NC_CLOUD_SES_ACCESS_SECRET,
          region: process.env.NC_CLOUD_SES_REGION,
          from: process.env.NC_CLOUD_SES_FROM,
        }),
        active: true,
      },
      sesPluginData.id
    );
  }
};
