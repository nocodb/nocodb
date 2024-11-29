import { S3 as S3Client } from '@aws-sdk/client-s3';
import type { S3ClientConfig } from '@aws-sdk/client-s3';

import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import GenericS3 from '~/plugins/GenericS3/GenericS3';

interface ScalewayObjectStorageInput {
  bucket: string;
  region: string;
  access_key: string;
  access_secret: string;
  acl?: string;
}

export default class ScalewayObjectStorage
  extends GenericS3
  implements IStorageAdapterV2
{
  name = 'ScalewayObjectStorage';

  protected input: ScalewayObjectStorageInput;

  constructor(input: unknown) {
    super(input as ScalewayObjectStorageInput);
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
      endpoint: `https://s3.${this.input.region}.scw.cloud`,
    };

    this.s3Client = new S3Client(s3Options);
  }
}
