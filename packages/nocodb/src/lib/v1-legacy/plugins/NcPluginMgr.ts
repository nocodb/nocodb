import {
  XcEmailPlugin,
  XcStoragePlugin,
  XcWebhookNotificationPlugin,
} from 'nc-plugin';

import BackblazePluginConfig from '../../plugins/backblaze';
import DiscordPluginConfig from '../../plugins/discord';
import GcsPluginConfig from '../../plugins/gcs';
import LinodePluginConfig from '../../plugins/linode';
import MattermostPluginConfig from '../../plugins/mattermost';
import MinioPluginConfig from '../../plugins/mino';
import OvhCloudPluginConfig from '../../plugins/ovhCloud';
import ScalewayPluginConfig from '../../plugins/scaleway';
import S3PluginConfig from '../../plugins/s3';
import SlackPluginConfig from '../../plugins/slack';
import SMTPPluginConfig from '../../plugins/smtp';
import MailerSendConfig from '../../plugins/mailerSend';
import SpacesPluginConfig from '../../plugins/spaces';
import TeamsPluginConfig from '../../plugins/teams';
import TwilioPluginConfig from '../../plugins/twilio';
import TwilioWhatsappPluginConfig from '../../plugins/twilioWhatsapp';
import UpcloudPluginConfig from '../../plugins/upcloud';
import VultrPluginConfig from '../../plugins/vultr';
import SESPluginConfig from '../../plugins/ses';
import Local from './adapters/storage/Local';
import type Noco from '../../Noco';
import type NcMetaIO from '../../meta/NcMetaIO';

import type {
  IEmailAdapter,
  IStorageAdapter,
  IWebhookNotificationAdapter,
  XcPlugin,
} from 'nc-plugin';

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
  ScalewayPluginConfig,
  MailerSendConfig,
  SESPluginConfig,
];

class NcPluginMgr {
  private ncMeta: NcMetaIO;
  private app: Noco;

  /* active plugins */
  private activePlugins: Array<XcPlugin | XcStoragePlugin | XcEmailPlugin>;

  constructor(app: Noco, ncMeta: NcMetaIO) {
    this.app = app;
    this.ncMeta = ncMeta;
    this.activePlugins = [];
  }

  public async init(): Promise<void> {
    /* Populate rows into nc_plugins table if not present */
    for (const plugin of defaultPlugins) {
      const pluginConfig = await this.ncMeta.metaGet(null, null, 'nc_plugins', {
        title: plugin.title,
      });

      if (!pluginConfig) {
        await this.ncMeta.metaInsert(null, null, 'nc_plugins', {
          title: plugin.title,
          version: plugin.version,
          logo: plugin.logo,
          description: plugin.description,
          tags: plugin.tags,
          category: plugin.category,
          input_schema: JSON.stringify(plugin.inputs),
        });
      }

      /* init only the active plugins */
      if (pluginConfig?.active) {
        const tempPlugin = new plugin.builder(this.app, plugin);

        this.activePlugins.push(tempPlugin);

        if (pluginConfig?.input) {
          pluginConfig.input = JSON.parse(pluginConfig.input);
        }

        try {
          await tempPlugin.init(pluginConfig?.input);
        } catch (e) {
          console.log(
            `Plugin(${plugin?.title}) initialization failed : ${e.message}`
          );
        }
      }
    }
  }

  public async reInit(): Promise<void> {
    this.activePlugins = [];
    await this.init();
  }

  public get storageAdapter(): IStorageAdapter {
    return (
      (
        this.activePlugins?.find(
          (plugin) => plugin instanceof XcStoragePlugin
        ) as XcStoragePlugin
      )?.getAdapter() || new Local()
    );
  }

  public get emailAdapter(): IEmailAdapter {
    return (
      this.activePlugins?.find(
        (plugin) => plugin instanceof XcEmailPlugin
      ) as XcEmailPlugin
    )?.getAdapter();
  }

  public get webhookNotificationAdapters(): {
    [key: string]: IWebhookNotificationAdapter;
  } {
    return this.activePlugins?.reduce((obj, plugin) => {
      if (plugin instanceof XcWebhookNotificationPlugin) {
        obj[plugin?.config?.title] = (
          plugin as XcWebhookNotificationPlugin
        )?.getAdapter();
      }
      return obj;
    }, {});
  }

  public async test(args: any): Promise<boolean> {
    switch (args.category) {
      case 'Storage':
        {
          const plugin = defaultPlugins.find(
            (pluginConfig) => pluginConfig?.title === args.title
          );
          const tempPlugin = new plugin.builder(this.app, plugin);
          await tempPlugin.init(args?.input);
          return tempPlugin?.getAdapter()?.test?.();
        }
        break;
      case 'Email':
        {
          const plugin = defaultPlugins.find(
            (pluginConfig) => pluginConfig?.title === args.title
          );
          const tempPlugin = new plugin.builder(this.app, plugin);
          await tempPlugin.init(args?.input);
          return tempPlugin?.getAdapter()?.test?.();
        }
        break;
      default:
        throw new Error('Test not implemented');
    }
  }
}

export default NcPluginMgr;
