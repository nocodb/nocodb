import {
  IEmailAdapter,
  IStorageAdapter,
  IWebhookNotificationAdapter
  // XcEmailPlugin,
  // XcPlugin,
  // XcStoragePlugin,
  // XcWebhookNotificationPlugin
} from 'nc-plugin';

import BackblazePluginConfig from '../../../../plugins/backblaze';
import DiscordPluginConfig from '../../../../plugins/discord';
import GcsPluginConfig from '../../../../plugins/gcs';
import LinodePluginConfig from '../../../../plugins/linode';
import MattermostPluginConfig from '../../../../plugins/mattermost';
import MinioPluginConfig from '../../../../plugins/mino';
import OvhCloudPluginConfig from '../../../../plugins/ovhCloud';
import S3PluginConfig from '../../../../plugins/s3';
import ScalewayPluginConfig from '../../../../plugins/scaleway';
import SlackPluginConfig from '../../../../plugins/slack';
import SMTPPluginConfig from '../../../../plugins/smtp';
import MailerSendConfig from '../../../../plugins/mailerSend';
import SpacesPluginConfig from '../../../../plugins/spaces';
import TeamsPluginConfig from '../../../../plugins/teams';
import TwilioPluginConfig from '../../../../plugins/twilio';
import TwilioWhatsappPluginConfig from '../../../../plugins/twilioWhatsapp';
import UpcloudPluginConfig from '../../../../plugins/upcloud';
import VultrPluginConfig from '../../../../plugins/vultr';
import SESPluginConfig from '../../../../plugins/ses';
import Noco from '../../Noco';
import Local from '../../plugins/adapters/storage/Local';
import { MetaTable } from '../../../utils/globals';
import { PluginCategory } from 'nocodb-sdk';

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
  SESPluginConfig
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
        title: plugin.title
      });

      if (!pluginConfig) {
        await ncMeta.metaInsert2(null, null, MetaTable.PLUGIN, {
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
      // if (pluginConfig?.active) {
      //   const tempPlugin = new plugin.builder(this.app, plugin);
      //
      //   this.activePlugins.push(tempPlugin);
      //
      //   if (pluginConfig?.input) {
      //     pluginConfig.input = JSON.parse(pluginConfig.input);
      //   }
      //
      //   try {
      //     await tempPlugin.init(pluginConfig?.input);
      //   } catch (e) {
      //     console.log(
      //       `Plugin(${plugin?.title}) initialization failed : ${e.message}`
      //     );
      //   }
      // }
    }
  }

  public static async storageAdapter(
    ncMeta = Noco.ncMeta
  ): Promise<IStorageAdapter> {
    const pluginData = await ncMeta.metaGet2(null, null, MetaTable.PLUGIN, {
      category: PluginCategory.STORAGE,
      active: true
    });

    if (!pluginData) return new Local();

    const pluginConfig = defaultPlugins.find(
      c => c.title === pluginData.title && c.category === PluginCategory.STORAGE
    );
    const plugin = new pluginConfig.builder(ncMeta, pluginData);

    if (pluginData?.input) {
      pluginData.input = JSON.parse(pluginData.input);
    }

    await plugin.init(pluginData?.input);
    return plugin as IStorageAdapter;
  }

  public static async emailAdapter(
    ncMeta = Noco.ncMeta
  ): Promise<IEmailAdapter> {
    const pluginData = await ncMeta.metaGet2(null, null, MetaTable.PLUGIN, {
      category: PluginCategory.EMAIL,
      active: true
    });

    const pluginConfig = defaultPlugins.find(
      c => c.title === pluginData.title && c.category === PluginCategory.EMAIL
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
    ncMeta = Noco.ncMeta
  ): Promise<IWebhookNotificationAdapter> {
    const pluginData = await ncMeta.metaGet2(null, null, MetaTable.PLUGIN, {
      title,
      active: true
    });

    if (!pluginData) throw new Error('Plugin not configured/active');

    const pluginConfig = defaultPlugins.find(c => c.title === pluginData.title);
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
            pluginConfig => pluginConfig?.title === args.title
          );
          const tempPlugin = new plugin.builder(Noco.ncMeta, plugin);
          await tempPlugin.init(args?.input);
          return tempPlugin?.getAdapter()?.test?.();
        }
        break;
      case 'Email':
        {
          const plugin = defaultPlugins.find(
            pluginConfig => pluginConfig?.title === args.title
          );
          const tempPlugin = new plugin.builder(Noco.ncMeta, plugin);
          await tempPlugin.init(args?.input);
          return tempPlugin?.getAdapter()?.test?.();
        }
        break;
      default: {
        const plugin = defaultPlugins.find(
          pluginConfig => pluginConfig?.title === args.title
        );
        const tempPlugin = new plugin.builder(Noco.ncMeta, plugin);
        await tempPlugin.init(args?.input);
        return tempPlugin?.getAdapter()?.test?.();
      }
    }
  }
}

export default NcPluginMgrv2;

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Bhanu P Chaudhary <bhanu423@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
