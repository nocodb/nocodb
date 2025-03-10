import Cloudflare from 'cloudflare';
import R2 from './R2';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import { XcStoragePlugin } from '~/types/nc-plugin';

class R2Plugin extends XcStoragePlugin {
    private static storageAdapter: R2;
    private cloudflare: any;
    private config: any;

    constructor(config: any) {
        super();
        this.config = config;
        this.cloudflare = new Cloudflare({
            token: process.env.CLOUDFLARE_API_TOKEN || config.CloudflareApiToken,
        });
    }

    public getAdapter(): IStorageAdapterV2 {
        return R2Plugin.storageAdapter;
    }

    public async init(config: any): Promise<any> {
        this.config = config;
        const { custom_domain, bucket } = config;
        R2Plugin.storageAdapter = new R2(config);
        await R2Plugin.storageAdapter.init();
        if (custom_domain) {
            await this.setCustomDomain(bucket, custom_domain);
        }
    }

    private async setCustomDomain(bucketName: string, domainName: string) {
        if (!bucketName || !domainName) {
            throw new Error("Bucket name and domain name are required.");
        }
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || this.config.accountId;
        const zoneId = process.env.CLOUDFLARE_ZONE_ID || this.config.zoneId;
        if (!accountId || !zoneId) {
            throw new Error("Cloudflare accountId or zoneId is missing.");
        }
        try {
            const response = await this.cloudflare.r2.buckets.domains.custom.create({
                bucketName,
                domain: domainName,
                enabled: true,
                zoneId,
            }, { accountId });
            console.log(`Custom domain "${response.domain}" set for bucket "${bucketName}"`);
            return response;
        } catch (error) {
            console.error(`Failed to set custom domain for bucket "${bucketName}":`, error);
            throw error;
        }
    }
}

export default R2Plugin;
