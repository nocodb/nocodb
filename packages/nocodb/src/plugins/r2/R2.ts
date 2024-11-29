import { S3 as S3Client } from '@aws-sdk/client-s3';

import type { S3ClientConfigType } from '@aws-sdk/client-s3';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import GenericS3 from '~/plugins/GenericS3/GenericS3';

interface R2ObjectStorageInput {
  bucket: string;
  access_key: string;
  access_secret: string;
  hostname: string;
  region: string;
}

export default class R2 extends GenericS3 implements IStorageAdapterV2 {
  name = 'R2';

  protected input: R2ObjectStorageInput;

  constructor(input: unknown) {
    super(input as R2ObjectStorageInput);
  }

  protected get defaultParams() {
    return {
      Bucket: this.input.bucket,
      // R2 does not support ACL
      ACL: 'private',
    };
  }

  public async init(): Promise<any> {
    const s3Options: S3ClientConfigType = {
      region: 'auto',
      endpoint: this.input.hostname,
      credentials: {
        accessKeyId: this.input.access_key,
        secretAccessKey: this.input.access_secret,
      },
    };

    this.s3Client = new S3Client(s3Options);
  }
}
