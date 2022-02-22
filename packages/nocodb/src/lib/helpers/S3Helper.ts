import S3PluginConfig from '../../plugins/s3';
import S3 from '../../plugins/s3/S3';

/**
 * The plugin configuration object
 * @type {PluginConfig}
 */
export async function pluginConfigFn() {
  if (this.pluginConfig) return this.pluginConfig;

  return await this.app.ncMeta.metaGet(null, null, 'nc_plugins', {
    title: S3PluginConfig.title
  });
}

/**
 * initializes s3 plugin
 */
export async function initS3Plugin() {
  if (!this.pluginConfig) {
    this.pluginConfig = await pluginConfigFn.call(this);
  }
  this.S3Plugin = new S3PluginConfig.builder(this.app, S3PluginConfig);
  await this.S3Plugin.init(JSON.parse(this.pluginConfig.input));
}

/**
 * get s3 adapter
 * @returns {Promise<S3>}
 */
export async function getS3Adapter(): Promise<S3> {
  if (!this.S3Plugin) {
    await initS3Plugin.call(this);
  }
  return this.S3Plugin.getAdapter() as S3;
}
