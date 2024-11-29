import { Upload } from '@aws-sdk/lib-storage';
import { S3 as S3Client } from '@aws-sdk/client-s3';
import type { PutObjectCommandInput, S3ClientConfig } from '@aws-sdk/client-s3';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import GenericS3 from '~/plugins/GenericS3/GenericS3';

interface BackblazeObjectStorageInput {
  bucket: string;
  region: string;
  access_key: string;
  access_secret: string;
  acl?: string;
}

export default class Backblaze extends GenericS3 implements IStorageAdapterV2 {
  name = 'Backblaze';

  protected input: BackblazeObjectStorageInput;

  constructor(input: unknown) {
    super(input as BackblazeObjectStorageInput);
  }

  protected get defaultParams() {
    return {
      Bucket: this.input.bucket,
      ACL: this.input?.acl || 'public-read',
    };
  }

  public async init(): Promise<any> {
    const s3Options: S3ClientConfig = {
      region: this.patchRegion(this.input.region),
      credentials: {
        accessKeyId: this.input.access_key,
        secretAccessKey: this.input.access_secret,
      },
      endpoint: `https://s3.${this.patchRegion(
        this.input.region,
      )}.backblazeb2.com`,
    };

    this.s3Client = new S3Client(s3Options);
  }
  protected patchKey(key: string): string {
    if (
      key.startsWith(`${this.input.bucket}/nc/uploads`) ||
      key.startsWith(`${this.input.bucket}/nc/thumbnails`)
    ) {
      key = key.replace(`${this.input.bucket}/`, '');
    }

    return key;
  }

  protected async upload(uploadParams: PutObjectCommandInput): Promise<any> {
    try {
      const upload = new Upload({
        client: this.s3Client,
        params: uploadParams,
      });

      const data = await upload.done();

      if (data) {
        return `https://${this.input.bucket}.s3.${this.input.region}.backblazeb2.com/${uploadParams.Key}`;
      }
    } catch (error) {
      console.error('Error uploading file', error);
      throw error;
    }
  }

  patchRegion(region: string): string {
    // in v0.0.1, we constructed the endpoint with `region = s3.us-west-001`
    // in v0.0.2, `region` would be `us-west-001`
    // as backblaze states Region is the 2nd part of your S3 Endpoint in documentation
    if (region.startsWith('s3.')) {
      region = region.slice(3);
    }
    return region;
  }
}
