import { S3 as S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import type { IStorageAdapterV2 } from 'nc-plugin';
import GenericS3 from '~/plugins/GenericS3/GenericS3';

interface S3Input {
  bucket: string;
  region: string;
  access_key: string;
  access_secret: string;
  endpoint?: string;
}

export default class S3 extends GenericS3 implements IStorageAdapterV2 {
  protected input: S3Input;

  constructor(input: any) {
    super(input as S3Input);
  }

  get defaultParams() {
    return {
      ACL: 'private',
      Bucket: this.input.bucket,
    };
  }

  public async init(): Promise<any> {
    const s3Options: S3ClientConfig = {
      region: this.input.region,
      credentials: {
        accessKeyId: this.input.access_key,
        secretAccessKey: this.input.access_secret,
      },
    };

    if (this.input.endpoint) {
      s3Options.endpoint = this.input.endpoint;
    }

    this.s3Client = new S3Client(s3Options);
  }

  public async fileRead(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.s3Client.getObject({ Key: key } as any, (err, data) => {
        if (err) {
          return reject(err);
        }
        if (!data?.Body) {
          return reject(data);
        }
        return resolve(data.Body);
      });
    });
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
