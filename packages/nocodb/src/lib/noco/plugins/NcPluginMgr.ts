import NcMetaIO from "../meta/NcMetaIO";
import {
  IEmailAdapter,
  IStorageAdapter,
  IWebhookNotificationAdapter,
  XcEmailPlugin,
  XcPlugin,
  XcStoragePlugin, XcWebhookNotificationPlugin
} from "nc-plugin";

import S3PluginConfig from "../../../plugins/s3";
import GcsPluginConfig from "../../../plugins/gcs";
import LinodePluginConfig from "../../../plugins/linode";
import BackblazePluginConfig from "../../../plugins/backblaze";
import VultrPluginConfig from "../../../plugins/vultr";
import OvhCloudPluginConfig from "../../../plugins/ovhCloud";
import MinioPluginConfig from "../../../plugins/mino";
import SpacesPluginConfig from "../../../plugins/spaces";
import UpcloudPluginConfig from "../../../plugins/upcloud";
import SMTPPluginConfig from "../../../plugins/smtp";
import SlackPluginConfig from "../../../plugins/slack";
import TeamsPluginConfig from "../../../plugins/teams";
import MattermostPluginConfig from "../../../plugins/mattermost";
import DiscordPluginConfig from "../../../plugins/discord";
import TwilioWhatsappPluginConfig from "../../../plugins/twilioWhatsapp";
import TwilioPluginConfig from "../../../plugins/twilio";

import Noco from "../Noco";
import Local from "./adapters/storage/Local";

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
]

class NcPluginMgr {

  private ncMeta: NcMetaIO;
  private app: Noco;

  /* active plugins */
  private activePlugins: Array<XcPlugin | XcStoragePlugin | XcEmailPlugin>

  constructor(app: Noco, ncMeta: NcMetaIO) {
    this.app = app;
    this.ncMeta = ncMeta;
    this.activePlugins = [];
  }

  public async init(): Promise<void> {

    /* Populate rows into nc_plugins table if not present */
    for (const plugin of defaultPlugins) {

      const pluginConfig = (await this.ncMeta.metaGet(null, null, 'nc_plugins', {
        title: plugin.title
      }));

      if (!pluginConfig) {

        await this.ncMeta.metaInsert(null, null, 'nc_plugins', {
          title: plugin.title,
          version: plugin.version,
          logo: plugin.logo,
          description: plugin.description,
          tags: plugin.tags,
          category: plugin.category,
          input_schema: JSON.stringify(plugin.inputs)
        });

      }

      /* init only the active plugins */
      if (pluginConfig?.active) {

        const tempPlugin = new plugin.builder(this.app, plugin);

        this.activePlugins.push(tempPlugin);

        if (pluginConfig?.input) {
          pluginConfig.input = JSON.parse(pluginConfig.input);
        }

        await tempPlugin.init(pluginConfig?.input);

      }

    }
  }


  public async reInit(): Promise<void> {
    this.activePlugins = [];
    await this.init();
  }


  public get storageAdapter(): IStorageAdapter {
    return (this.activePlugins?.find(plugin => plugin instanceof XcStoragePlugin) as XcStoragePlugin)?.getAdapter() || new Local();
  }

  public get emailAdapter(): IEmailAdapter {
    return (this.activePlugins?.find(plugin => plugin instanceof XcEmailPlugin) as XcEmailPlugin)?.getAdapter();
  }

  public get webhookNotificationAdapters(): { [key: string]: IWebhookNotificationAdapter } {
    return this.activePlugins?.reduce((obj, plugin) => {
      if (plugin instanceof XcWebhookNotificationPlugin) {
        obj[plugin?.config?.title] = (plugin as XcWebhookNotificationPlugin)?.getAdapter()
      }
      return obj;
    }, {});

  }

}

export default NcPluginMgr;