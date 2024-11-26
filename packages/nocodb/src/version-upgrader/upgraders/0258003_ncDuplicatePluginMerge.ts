import type { NcUpgraderCtx } from '~/version-upgrader/NcUpgrader';
import SlackPluginConfig from '~/plugins/slack';
import TeamsPluginConfig from '~/plugins/teams';
import DiscordPluginConfig from '~/plugins/discord';
import TwilioWhatsappPluginConfig from '~/plugins/twilioWhatsapp';
import TwilioPluginConfig from '~/plugins/twilio';
import S3PluginConfig from '~/plugins/s3';
import MinioPluginConfig from '~/plugins/mino';
import GcsPluginConfig from '~/plugins/gcs';
import MattermostPluginConfig from '~/plugins/mattermost';
import SpacesPluginConfig from '~/plugins/spaces';
import BackblazePluginConfig from '~/plugins/backblaze';
import VultrPluginConfig from '~/plugins/vultr';
import OvhCloudPluginConfig from '~/plugins/ovhCloud';
import LinodePluginConfig from '~/plugins/linode';
import UpcloudPluginConfig from '~/plugins/upcloud';
import SMTPPluginConfig from '~/plugins/smtp';
import MailerSendConfig from '~/plugins/mailerSend';
import ScalewayPluginConfig from '~/plugins/scaleway';
import SESPluginConfig from '~/plugins/ses';
import R2PluginConfig from '~/plugins/r2';
import { MetaTable } from '~/cli';

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
  R2PluginConfig,
];

// This upgrader helps to merge the duplicate plugins and recover the broken plugins
// and also adds a unique id to the plugin to avoid the duplicate plugins in the future
export default async function ({ ncMeta }: NcUpgraderCtx) {
  // get the plugins which are valid and matches the plugin title
  // update the plugin with the new id
  for (const pluginConfig of defaultPlugins) {
    // get the valid plugin
    const plugin = await ncMeta
      .knex(MetaTable.PLUGIN)
      .where('title', pluginConfig.title)
      .first();

    if (plugin) {
      // update the plugin with the new id
      await ncMeta
        .knex(MetaTable.PLUGIN)
        .where('id', plugin.id)
        .update({ id: pluginConfig.id });
    }

    if (pluginConfig.fallbackTitle) {
      // get the plugin with old title
      const oldPlugin = await ncMeta
        .knex(MetaTable.PLUGIN)
        .where('title', pluginConfig.fallbackTitle)
        .first();

      if (plugin) {
        // if the old plugin is present then update the new plugin with the old plugin configuration
        // and only if new plugin is not configured and active
        if (!plugin.active && oldPlugin.active) {
          await ncMeta
            .knex(MetaTable.PLUGIN)
            .update({
              input: oldPlugin.input,
              active: true,
            })
            .where('id', plugin.id);
        }

        // delete the old plugin
        await ncMeta.knex(MetaTable.PLUGIN).where('id', oldPlugin.id).delete();
      } else {
        // if new plugin is not present then update the old plugin with the new id
        // we can skip rest of the props since it will get updated from the existing plugin initialization
        await ncMeta
          .knex(MetaTable.PLUGIN)
          .where('id', oldPlugin.id)
          .update({ id: pluginConfig.id });
      }
    }
  }
}
