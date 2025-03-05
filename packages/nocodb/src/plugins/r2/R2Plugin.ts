import Cloudflare from 'cloudflare';
import R2 from './R2';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import { XcStoragePlugin } from '~/types/nc-plugin';

class R2Plugin extends XcStoragePlugin {
<<<<<<< HEAD
    private static storageAdapter: R2;
    private cloudflare: any;
    private config: any;
=======
  private static storageAdapter: R2;
  private cloudflare: any;

  constructor() {
    super();
    this.cloudflare = new Cloudflare({ token: 'your-api-key' });
  }
>>>>>>> 0bb8e498c19e6ee31f0729e8dc322a6902423e18

    constructor(config: any) {
        super();
        this.config = config;
        this.cloudflare = new Cloudflare({
            token: process.env.CLOUDFLARE_API_TOKEN || config.CloudflareApiToken,
        });
    }

<<<<<<< HEAD
    public getAdapter(): IStorageAdapterV2 {
        return R2Plugin.storageAdapter;
    }

    public async init(config: any): Promise<any> {
        this.config = config;
        this.cloudflare = new Cloudflare({
            token: process.env.CLOUDFLARE_API_TOKEN || config.CloudflareApiToken,
        });

        const { custom_domain, bucket } = config;

        R2Plugin.storageAdapter = new R2(config);
        await R2Plugin.storageAdapter.init();

        if (custom_domain) {
            await this.setCustomDomain(bucket, custom_domain);
        }
    }

    private async setCustomDomain(bucketName: string, domainName: string) {
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || this.config?.accountId;
        const zoneId = process.env.CLOUDFLARE_ZONE_ID || this.config?.zoneId;

        if (!accountId || !zoneId) {
            throw new Error("Cloudflare accountId or zoneId is missing.");
        }

        const response = await this.cloudflare.r2.buckets.domains.custom.create({
            bucketName,
            domain: domainName,
            enabled: true,
            zoneId,
        }, { accountId });

        console.log("Custom domain set:", response.domain);
    }
=======
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
>>>>>>> 0bb8e498c19e6ee31f0729e8dc322a6902423e18
}

export default R2Plugin;
