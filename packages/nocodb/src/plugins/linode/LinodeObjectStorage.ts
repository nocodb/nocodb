import { S3 as S3Client } from '@aws-sdk/client-s3';
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import GenericS3 from '~/plugins/GenericS3/GenericS3';

interface LinodeObjectStorageInput {
  bucket: string;
  region: string;
  access_key: string;
  access_secret: string;
  acl?: string;
}

export default class LinodeObjectStorage
  extends GenericS3
  implements IStorageAdapterV2
{
  name = 'LinodeObjectStorage';

  protected input: LinodeObjectStorageInput;
  constructor(input: unknown) {
    super(input as LinodeObjectStorageInput);
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
      endpoint: `https://${this.input.region}.linodeobjects.com`,
    };

    this.s3Client = new S3Client(s3Options);
  }
}
