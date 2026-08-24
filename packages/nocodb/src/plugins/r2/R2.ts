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

  private get endpoint(): URL {
    const hostname = this.input.hostname.trim();
    return new URL(
      /^https?:\/\//i.test(hostname) ? hostname : `https://${hostname}`,
    );
  }

  private getObjectKey(key: string): string {
    let pathname = key;

    try {
      pathname = new URL(key).pathname;
    } catch {}

    try {
      pathname = decodeURI(pathname);
    } catch {}
    pathname = pathname.replace(/^\/+/, '');

    const bucketPrefix = `${this.input.bucket}/`;
    return pathname.startsWith(bucketPrefix)
      ? pathname.slice(bucketPrefix.length)
      : pathname;
  }

  private getObjectUrl(key: string): string {
    const endpoint = this.endpoint;
    if (!endpoint.hostname.startsWith(`${this.input.bucket}.`)) {
      endpoint.hostname = `${this.input.bucket}.${endpoint.hostname}`;
    }
    endpoint.pathname = `/${this.getObjectKey(key)}`;
    endpoint.search = '';
    endpoint.hash = '';
    return endpoint.toString();
  }

  protected get defaultParams() {
    return {
      Bucket: this.input.bucket,
      // R2 does not support ACL
      ACL: 'private',
    };
  }

  protected patchKey(key: string): string {
    return this.getObjectKey(key);
  }

  protected patchUploadReturnKey(key: string): string {
    return this.getObjectUrl(key);
  }

  public async init(): Promise<any> {
    const s3Options: S3ClientConfigType = {
      region: 'auto',
      endpoint: this.endpoint.origin,
      credentials: {
        accessKeyId: this.input.access_key,
        secretAccessKey: this.input.access_secret,
      },
    };

    this.s3Client = new S3Client(s3Options);
  }

  override getUploadedPath(path: string): { path?: string; url?: string } {
    return {
      url: this.getObjectUrl(path),
    };
  }
}
