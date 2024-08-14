import { S3 as S3Client } from '@aws-sdk/client-s3';
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import GenericS3 from '~/plugins/GenericS3/GenericS3';

interface OvhCloudStorageInput {
  bucket: string;
  region: string;
  access_key: string;
  access_secret: string;
  acl?: string;
}

export default class OvhCloud extends GenericS3 implements IStorageAdapterV2 {
  name = 'OvhCloud';

  protected input: OvhCloudStorageInput;

  constructor(input: unknown) {
    super(input as OvhCloudStorageInput);
  }

  protected get defaultParams() {
    return {
      Bucket: this.input.bucket,
      ACL: this.input?.acl || 'public-read',
    };
  }

  public async init(): Promise<any> {
    const s3Options: S3ClientConfig = {
      region: this.input.region,
      credentials: {
        accessKeyId: this.input.access_key,
        secretAccessKey: this.input.access_secret,
      },
      // TODO: Need to verify
      // DOCS s3.<region_in_lowercase>.io.cloud.ovh.net
      endpoint: `https://s3.${this.input.region}.cloud.ovh.net`,
    };

    this.s3Client = new S3Client(s3Options);
  }
}
