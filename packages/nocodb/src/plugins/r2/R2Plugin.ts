import Cloudflare from 'cloudflare';
import R2 from './R2';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import { XcStoragePlugin } from '~/types/nc-plugin';

class R2Plugin extends XcStoragePlugin {
  private static storageAdapter: R2;
  private cloudflare: any;

  constructor() {
    super();
    this.cloudflare = new Cloudflare({ token: 'your-api-key' });
  }

  public getAdapter(): IStorageAdapterV2 {
    return R2Plugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    const { custom_domain, bucket } = config;

    R2Plugin.storageAdapter = new R2(config);
    await R2Plugin.storageAdapter.init();

    // Set the custom domain if provided
    if (custom_domain) {
      await this.setCustomDomain(bucket, custom_domain);
    }
  }

  private async setCustomDomain(bucketName: string, domainName: string) {
    const accountId = 'your-account-id';
    const zoneId = 'your-zone-id';

    const response = await this.cloudflare.r2.buckets.domains.custom.create({
      bucketName,
      domain: domainName,
      enabled: true,
      zoneId,
    }, { accountId });

    console.log('Custom domain set:', response.domain);
  }
}

export default R2Plugin;
