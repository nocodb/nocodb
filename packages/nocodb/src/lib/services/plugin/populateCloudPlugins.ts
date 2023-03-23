import { MetaTable } from '../../utils/globals';
import Noco from '../..';

export const populatePluginsForCloud = async ({ ncMeta = Noco.ncMeta }) => {
  if (
    !process.env.NC_ClOUD_S3_ACCESS_KEY ||
    !process.env.NC_ClOUD_S3_ACCESS_SECRET ||
    !process.env.NC_ClOUD_S3_BUCKET_NAME ||
    !process.env.NC_ClOUD_S3_REGION
  ) {
    throw new Error('S3 env variables not found');
  }

  const s3PluginData = await ncMeta.metaGet2(null, null, MetaTable.PLUGIN, {
    title: 'S3',
  });

  if (s3PluginData) {
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.PLUGIN,
      {
        input: JSON.stringify({
          access_key: process.env.NC_ClOUD_S3_ACCESS_KEY,
          access_secret: process.env.NC_ClOUD_S3_ACCESS_SECRET,
          bucket: process.env.NC_ClOUD_S3_BUCKET_NAME,
          region: process.env.NC_ClOUD_S3_REGION,
        }),
        active: true,
      },
      s3PluginData.id
    );
  } else {
    throw new Error('S3 plugin not found');
  }
};
