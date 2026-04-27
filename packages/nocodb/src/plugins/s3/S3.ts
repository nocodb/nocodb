import { S3 as S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import GenericS3 from '~/plugins/GenericS3/GenericS3';
import { S3_PATCH_KEYS } from '~/constants';
import { NcError } from '~/helpers/ncError';

interface S3Input {
  bucket: string;
  region?: string;
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
      S3_PATCH_KEYS.some((k) => key.startsWith(`${this.input.bucket}/nc/${k}`))
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

    if (this.input.endpoint) {
      // Some S3-compatible providers (e.g. Wasabi) return a Date response header
      // in a non-RFC7231 format such as "2026-01-22 10:31:53.050863199 +0000 UTC".
      // The AWS SDK v3 cannot parse this format and throws an uncaught error that
      // surfaces as an "invalid date" or "Cannot set headers after they are sent"
      // failure. Add a deserialize middleware that normalises the Date header to a
      // valid RFC7231 string before the SDK processes the response.
      this.s3Client.middlewareStack.add(
        (next) => async (args) => {
          const result = await next(args);
          const response = result.response as any;
          if (response?.headers?.date) {
            const raw: string = response.headers.date;
            const parsed = new Date(raw);
            if (!isNaN(parsed.getTime())) {
              response.headers.date = parsed.toUTCString();
            }
          }
          return result;
        },
        {
          step: 'deserialize',
          name: 'normalizeNonRfc7231DateHeaderMiddleware',
          priority: 'high',
        },
      );
    }
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
        NcError._.storageFileCreateError('Upload failed or no data returned.');
      }
    } catch (error) {
      NcError._.storageFileCreateError(error.message);
    }
  }

  override getUploadedPath(path: string): { path?: string; url?: string } {
    const usePath = path.startsWith('/') ? path.replace(/$\/+/, '') : path;
    // TODO: more configurable urls, like using path-styles and CNAME
    // https://docs.aws.amazon.com/AmazonS3/latest/userguide/VirtualHosting.html
    return {
      url: `https://${this.input.bucket}.s3.${this.input.region}.amazonaws.com/${usePath}`,
    };
  }
}
