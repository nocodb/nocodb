import type { NcUpgraderCtx } from '~/version-upgrader/NcUpgrader';
import SlackPluginConfig from '~/plugins/slack';
import TeamsPluginConfig from '~/plugins/teams';
import DiscordPluginConfig from '~/plugins/discord';
import TwilioWhatsappPluginConfig from '~/plugins/twilioWhatsapp';
import TwilioPluginConfig from '~/plugins/twilio';
import S3PluginConfig from '~/plugins/s3';
import MinioPluginConfig from '~/plugins/minio';
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

const logger = {
  log: (message: string) => {
    console.log(`[0258003_ncDuplicatePluginMerge ${Date.now()}] ` + message);
  },
  error: (message: string) => {
    console.error(`[0258003_ncDuplicatePluginMerge ${Date.now()}] ` + message);
  },
};

// This upgrader helps to merge the duplicate plugins and recover the broken plugins
// and also adds a unique id to the plugin to avoid the duplicate plugins in the future
export default async function ({ ncMeta }: NcUpgraderCtx) {
  logger.log('Merging duplicate plugins and updating the plugin id');
  // get the plugins which are valid and matches the plugin title
  // update the plugin with the new id
  for (const pluginConfig of defaultPlugins) {
    // get the valid plugin
    const currentPlugin = await ncMeta
      .knex(MetaTable.PLUGIN)
      .where('title', pluginConfig.title)
      .first();

    if (currentPlugin) {
      // update the plugin with the new id
      await ncMeta
        .knex(MetaTable.PLUGIN)
        .where('id', currentPlugin.id)
        .update({ id: pluginConfig.id });
      currentPlugin.id = pluginConfig.id;
    }

    if (pluginConfig.recoveryTitle) {
      // get the plugin with old title
      const oldPlugin = await ncMeta
        .knex(MetaTable.PLUGIN)
        .where('title', pluginConfig.recoveryTitle)
        .first();

      // if the old plugin is not present then continue
      if (!oldPlugin) continue;

      if (currentPlugin) {
        // if the old plugin is present then update the new plugin with the old plugin configuration
        // and only if new plugin is not configured or active
        if (
          (!currentPlugin.active && oldPlugin?.active) ||
          (!currentPlugin.input && oldPlugin?.input)
        ) {
          await ncMeta
            .knex(MetaTable.PLUGIN)
            .update({
              input: oldPlugin.input,
              active: currentPlugin.active || oldPlugin.active,
            })
            // use the new plugin id since it's already updated at the start
            .where('id', pluginConfig.id);
          logger.log(
            `Merged the old plugin with the new plugin: ${pluginConfig.id}`,
          );
        }
        if (oldPlugin) {
          // delete the old plugin
          await ncMeta
            .knex(MetaTable.PLUGIN)
            .where('id', oldPlugin.id)
            .delete();
          logger.log(`Deleted the old duplicate plugin: ${oldPlugin.title}`);
        }
      } else {
        // if new plugin is not present then update the old plugin with the new id
        // we can skip rest of the props since it will get updated from the existing plugin initialization
        await ncMeta
          .knex(MetaTable.PLUGIN)
          .where('id', oldPlugin.id)
          .update({ id: pluginConfig.id });
        logger.log(`Updated the old plugin id: ${pluginConfig.id}`);
      }
    }
  }
  logger.log('Merging duplicate plugins and updating the plugin id completed');
}
