import { PluginCategory } from 'nocodb-sdk';
import { NcError } from './catchError';
import type {
  IEmailAdapter,
  IStorageAdapterV2,
  IWebhookNotificationAdapter,
  // XcEmailPlugin,
  // XcPlugin,
  // XcStoragePlugin,
  // XcWebhookNotificationPlugin
} from 'nc-plugin';
import BackblazePluginConfig from '~/plugins/backblaze';
import DiscordPluginConfig from '~/plugins/discord';
import GcsPluginConfig from '~/plugins/gcs';
import LinodePluginConfig from '~/plugins/linode';
import MattermostPluginConfig from '~/plugins/mattermost';
import MinioPluginConfig from '~/plugins/mino';
import OvhCloudPluginConfig from '~/plugins/ovhCloud';
import S3PluginConfig from '~/plugins/s3';
import ScalewayPluginConfig from '~/plugins/scaleway';
import SlackPluginConfig from '~/plugins/slack';
import SMTPPluginConfig from '~/plugins/smtp';
import MailerSendConfig from '~/plugins/mailerSend';
import SpacesPluginConfig from '~/plugins/spaces';
import TeamsPluginConfig from '~/plugins/teams';
import TwilioPluginConfig from '~/plugins/twilio';
import TwilioWhatsappPluginConfig from '~/plugins/twilioWhatsapp';
import UpcloudPluginConfig from '~/plugins/upcloud';
import VultrPluginConfig from '~/plugins/vultr';
import SESPluginConfig from '~/plugins/ses';
import Noco from '~/Noco';
import Local from '~/plugins/storage/Local';
import { MetaTable } from '~/utils/globals';
import Plugin from '~/models/Plugin';

const defaultPlugins = [
  SlackPluginConfig,
  TeamsPluginConfig,
  DiscordPluginConfig,
  TwilioWhatsappPluginConfig,
  TwilioPluginConfig,
  S3PluginConfig,
  MinioPluginConfig,
  GcsPluginConfig,
  MattermostPluginConfig,
  SpacesPluginConfig,
  BackblazePluginConfig,
  VultrPluginConfig,
  OvhCloudPluginConfig,
  LinodePluginConfig,
  UpcloudPluginConfig,
  SMTPPluginConfig,
  MailerSendConfig,
  ScalewayPluginConfig,
  SESPluginConfig,
];

class NcPluginMgrv2 {
  /* active plugins */

  // constructor(app: Noco, ncMeta: NcMetaIO) {
  //   this.app = app;
  //   this.ncMeta = ncMeta;
  //   this.activePlugins = [];
  // }

  public static async init(ncMeta = Noco.ncMeta): Promise<void> {
    /* Populate rows into nc_plugins table if not present */
    for (const plugin of defaultPlugins) {
      const pluginConfig = await ncMeta.metaGet(null, null, MetaTable.PLUGIN, {
        title: plugin.title,
      });

      if (!pluginConfig) {
        await ncMeta.metaInsert2(null, null, MetaTable.PLUGIN, {
          title: plugin.title,
          version: plugin.version,
          logo: plugin.logo,
          description: plugin.description,
          tags: plugin.tags,
          category: plugin.category,
          input_schema: JSON.stringify(plugin.inputs),
        });
      } else if (pluginConfig.version !== plugin.version) {
        await ncMeta.metaUpdate(
          null,
          null,
          MetaTable.PLUGIN,
          {
            title: plugin.title,
            version: plugin.version,
            logo: plugin.logo,
            description: plugin.description,
            tags: plugin.tags,
            category: plugin.category,
            input_schema: JSON.stringify(plugin.inputs),
          },
          pluginConfig.id,
        );
      }
    }
    await this.initPluginsFromEnv();
  }

  private static async initPluginsFromEnv() {
    /*
     * NC_S3_BUCKET_NAME
     * NC_S3_REGION
     * NC_S3_ACCESS_KEY
     * NC_S3_ACCESS_SECRET
     * */

    if (
      process.env.NC_S3_BUCKET_NAME &&
      process.env.NC_S3_REGION &&
      process.env.NC_S3_ACCESS_KEY &&
      process.env.NC_S3_ACCESS_SECRET
    ) {
      const s3Plugin = await Plugin.getPluginByTitle(S3PluginConfig.title);
      await Plugin.update(s3Plugin.id, {
        active: true,
        input: JSON.stringify({
          bucket: process.env.NC_S3_BUCKET_NAME,
          region: process.env.NC_S3_REGION,
          access_key: process.env.NC_S3_ACCESS_KEY,
          access_secret: process.env.NC_S3_ACCESS_SECRET,
        }),
      });
    }

    if (
      process.env.NC_SMTP_FROM &&
      process.env.NC_SMTP_HOST &&
      process.env.NC_SMTP_PORT
    ) {
      const smtpPlugin = await Plugin.getPluginByTitle(SMTPPluginConfig.title);
      await Plugin.update(smtpPlugin.id, {
        active: true,
        input: JSON.stringify({
          from: process.env.NC_SMTP_FROM,
          host: process.env.NC_SMTP_HOST,
          port: process.env.NC_SMTP_PORT,
          username: process.env.NC_SMTP_USERNAME,
          password: process.env.NC_SMTP_PASSWORD,
          secure: process.env.NC_SMTP_SECURE,
          ignoreTLS: process.env.NC_SMTP_IGNORE_TLS,
        }),
      });
    }
  }

  public static async storageAdapter(
    ncMeta = Noco.ncMeta,
  ): Promise<IStorageAdapterV2> {
    const pluginData = await ncMeta.metaGet2(null, null, MetaTable.PLUGIN, {
      category: PluginCategory.STORAGE,
      active: true,
    });

    if (!pluginData) return new Local();

    const pluginConfig = defaultPlugins.find(
      (c) =>
        c.title === pluginData.title && c.category === PluginCategory.STORAGE,
    );
    const plugin = new pluginConfig.builder(ncMeta, pluginData);

    if (pluginData?.input) {
      pluginData.input = JSON.parse(pluginData.input);
    }

    await plugin.init(pluginData?.input);
    return plugin.getAdapter();
  }

  public static async emailAdapter(
    isUserInvite = true,
    ncMeta = Noco.ncMeta,
  ): Promise<IEmailAdapter> {
    const pluginData = await ncMeta.metaGet2(null, null, MetaTable.PLUGIN, {
      category: PluginCategory.EMAIL,
      active: true,
    });

    if (!pluginData) {
      // return null to show the invite link in UI
      if (isUserInvite) return null;
      // for webhooks, throw the error
      throw new Error('Plugin not configured / active');
    }

    const pluginConfig = defaultPlugins.find(
      (c) =>
        c.title === pluginData.title && c.category === PluginCategory.EMAIL,
    );
    const plugin = new pluginConfig.builder(ncMeta, pluginData);

    if (pluginData?.input) {
      pluginData.input = JSON.parse(pluginData.input);
    }

    await plugin.init(pluginData?.input);
    return plugin.getAdapter();
  }

  public static async webhookNotificationAdapters(
    title: string,
    ncMeta = Noco.ncMeta,
  ): Promise<IWebhookNotificationAdapter> {
    const pluginData = await ncMeta.metaGet2(null, null, MetaTable.PLUGIN, {
      title,
      active: true,
    });

    if (!pluginData) throw new Error('Plugin not configured / active');

    const pluginConfig = defaultPlugins.find(
      (c) => c.title === pluginData.title,
    );
    const plugin = new pluginConfig.builder(ncMeta, pluginData);

    if (pluginData?.input) {
      pluginData.input = JSON.parse(pluginData.input);
    }

    await plugin.init(pluginData?.input);
    return plugin.getAdapter() as IWebhookNotificationAdapter;

    // return this.activePlugins?.reduce((obj, plugin) => {
    //   if (plugin instanceof XcWebhookNotificationPlugin) {
    //     obj[
    //       plugin?.config?.title
    //     ] = (plugin as XcWebhookNotificationPlugin)?.getAdapter();
    //   }
    //   return obj;
    // }, {});
  }

  public static async test(args): Promise<boolean> {
    args.input =
      typeof args?.input === 'string' ? JSON.parse(args?.input) : args?.input;
    switch (args.category) {
      case 'Storage':
        {
          const plugin = defaultPlugins.find(
            (pluginConfig) => pluginConfig?.title === args.title,
          );
          const tempPlugin = new plugin.builder(Noco.ncMeta, plugin);
          await tempPlugin.init(args?.input);

          if (!tempPlugin?.getAdapter()?.test)
            NcError.notImplemented('Plugin test is not implemented');

          return tempPlugin?.getAdapter()?.test?.();
        }
        break;
      case 'Email':
        {
          const plugin = defaultPlugins.find(
            (pluginConfig) => pluginConfig?.title === args.title,
          );
          const tempPlugin = new plugin.builder(Noco.ncMeta, plugin);
          await tempPlugin.init(args?.input);

          if (!tempPlugin?.getAdapter()?.test)
            NcError.notImplemented('Plugin test is not implemented');

          return tempPlugin?.getAdapter()?.test?.();
        }
        break;
      default: {
        const plugin = defaultPlugins.find(
          (pluginConfig) => pluginConfig?.title === args.title,
        );
        const tempPlugin = new plugin.builder(Noco.ncMeta, plugin);
        await tempPlugin.init(args?.input);

        if (!tempPlugin?.getAdapter()?.test)
          NcError.notImplemented('Plugin test is not implemented');

        return tempPlugin?.getAdapter()?.test?.();
      }
    }
  }
}

export default NcPluginMgrv2;
