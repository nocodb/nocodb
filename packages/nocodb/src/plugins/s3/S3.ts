import { S3 as S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import GenericS3 from '~/plugins/GenericS3/GenericS3';

interface S3Input {
  bucket: string;
  region: string;
  access_key?: string;
  access_secret?: string;
  endpoint?: string;
  acl?: string;
  force_path_style?: boolean;
}

export default class S3 extends GenericS3 implements IStorageAdapterV2 {
  name = 'S3';

  protected input: S3Input;

  constructor(input: any) {
    super(input as S3Input);
  }

  get defaultParams() {
    return {
      ...(this.input.acl ? { ACL: this.input.acl } : {}),
      Bucket: this.input.bucket,
    };
  }

  protected patchKey(key: string): string {
    if (!this.input.force_path_style) {
      return key;
    }

    if (
      key.startsWith(`${this.input.bucket}/nc/uploads`) ||
      key.startsWith(`${this.input.bucket}/nc/thumbnails`)
    ) {
      key = key.replace(`${this.input.bucket}/`, '');
    }

    return key;
  }

  public async init(): Promise<any> {
    const s3Options: S3ClientConfig = {
      region: this.input.region,
      forcePathStyle: this.input.force_path_style ?? false,
    };

    if (this.input.access_key && this.input.access_secret) {
      s3Options.credentials = {
        accessKeyId: this.input.access_key,
        secretAccessKey: this.input.access_secret,
      };
    }

    if (this.input.endpoint) {
      s3Options.endpoint = this.input.endpoint;
    }

    this.s3Client = new S3Client(s3Options);
  }

  protected async upload(uploadParams): Promise<any> {
    try {
      const upload = new Upload({
        client: this.s3Client,
        params: { ...this.defaultParams, ...uploadParams },
      });

      const data = await upload.done();

      if (data) {
        const endpoint = this.input.endpoint
          ? new URL(this.input.endpoint).host
          : `s3.${this.input.region}.amazonaws.com`;

        if (this.input.force_path_style) {
          return `https://${endpoint}/${this.input.bucket}/${uploadParams.Key}`;
        }

        return `https://${this.input.bucket}.${endpoint}/${uploadParams.Key}`;
      } else {
        throw new Error('Upload failed or no data returned.');
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
