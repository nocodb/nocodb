import { MetaTable } from '../../utils/globals';
import S3PluginConfig from '../../plugins/s3';
import SMTPPluginConfig from '../../plugins/smtp';
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
    title: S3PluginConfig.title,
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

  // SMTP
  if (
    !process.env.NC_ClOUD_SMTP_FROM ||
    !process.env.NC_ClOUD_SMTP_HOST ||
    !process.env.NC_ClOUD_SMTP_PORT ||
    !process.env.NC_ClOUD_SMTP_SECURE ||
    !process.env.NC_ClOUD_SMTP_IGNORE_TLS ||
    !process.env.NC_ClOUD_SMTP_REJECT_UNAUTHORIZED ||
    !process.env.NC_ClOUD_SMTP_USERNAME ||
    !process.env.NC_ClOUD_SMTP_PASSWORD
  ) {
    throw new Error('SMTP env variables not found');
  }

  const smtpPluginData = await ncMeta.metaGet2(null, null, MetaTable.PLUGIN, {
    title: SMTPPluginConfig.title,
  });

  if (smtpPluginData) {
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.PLUGIN,
      {
        input: JSON.stringify({
          from: process.env.NC_ClOUD_SMTP_FROM,
          host: process.env.NC_ClOUD_SMTP_HOST,
          port: process.env.NC_ClOUD_SMTP_PORT,
          secure: process.env.NC_ClOUD_SMTP_SECURE === 'true',
          ignoreTLS: process.env.NC_ClOUD_SMTP_IGNORE_TLS === 'true',
          rejectUnauthorized:
            process.env.NC_ClOUD_SMTP_REJECT_UNAUTHORIZED === 'true',
          username: process.env.NC_ClOUD_SMTP_USERNAME,
          password: process.env.NC_ClOUD_SMTP_PASSWORD,
        }),
        active: true,
      },
      smtpPluginData.id
    );
  } else {
    throw new Error('SMTP plugin not found');
  }
};
