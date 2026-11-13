import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { Readable } from 'stream';
import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import type { ContainerClient } from '@azure/storage-blob';
import type { IStorageAdapterV2, XcFile } from '~/types/nc-plugin';
import {
  fetchSourceFile,
  generateTempFilePath,
  waitForStreamClose,
} from '~/utils/pluginUtils';
import { NcError } from '~/helpers/ncError';

interface AzureBlobInput {
  container: string;
  connection_string?: string;
  account_name?: string;
  account_key?: string;
  endpoint?: string;
}

const CACHE_CONTROL = 'public, max-age=31536000';

// The SDK's RestError has an empty message on a 404
const errorMessage = (e: any, key?: string) =>
  e?.statusCode === 404 && key
    ? `File ${key} does not exist`
    : e?.message || e?.code || `HTTP ${e?.statusCode}`;

export default class AzureBlob implements IStorageAdapterV2 {
  name = 'AzureBlob';

  private containerClient: ContainerClient;
  // `<container>/`, or `<account>/<container>/` on Azurite-style endpoints
  private urlKeyPrefix: string;
  private input: AzureBlobInput;

  constructor(input: AzureBlobInput) {
    this.input = input;
  }

  // Keys derived from stored urls arrive url-encoded and prefixed with
  // `<urlKeyPrefix>`. Every path (create, sign, read) decodes once, so they agree.
  protected patchKey(key: string): string {
    try {
      key = decodeURIComponent(key);
    } catch {
      // not encoded
    }
    key = key.replace(/^\/+/, '');
    // Guarded like S3, so a raw `nc/...` key is never stripped
    const rest = key.slice(this.urlKeyPrefix.length);
    if (key.startsWith(this.urlKeyPrefix) && rest.startsWith('nc/')) {
      key = rest;
    }
    return key;
  }

  public async init(): Promise<void> {
    let serviceClient: BlobServiceClient;

    if (this.input.connection_string) {
      serviceClient = BlobServiceClient.fromConnectionString(
        this.input.connection_string,
      );
    } else if (this.input.account_name && this.input.account_key) {
      const endpoint =
        this.input.endpoint?.replace(/\/+$/, '') ||
        `https://${this.input.account_name}.blob.core.windows.net`;
      serviceClient = new BlobServiceClient(
        endpoint,
        new StorageSharedKeyCredential(
          this.input.account_name,
          this.input.account_key,
        ),
      );
    } else {
      NcError.badRequest(
        'Provide either a connection string or an account name and key',
      );
    }

    this.containerClient = serviceClient.getContainerClient(
      this.input.container,
    );
    this.urlKeyPrefix = `${decodeURIComponent(
      new URL(this.containerClient.url).pathname,
    ).replace(/^\/+/, '')}/`;
  }

  private blob(key: string) {
    return this.containerClient.getBlockBlobClient(this.patchKey(key));
  }

  public async test(): Promise<boolean> {
    try {
      const tempFile = generateTempFilePath();
      const createStream = fs.createWriteStream(tempFile);
      await waitForStreamClose(createStream);
      await this.fileCreate('nc-test-file.txt', {
        path: tempFile,
        mimetype: 'text/plain',
        originalname: 'temp.txt',
        size: createStream.bytesWritten.toString(),
      });
      await promisify(fs.unlink)(tempFile);
      // Attachments are served through SAS urls, so the credential must sign
      await this.getSignedUrl('nc-test-file.txt', 60);
      await this.fileDelete('nc-test-file.txt');
      return true;
    } catch (e) {
      NcError.pluginTestError(e?.message);
    }
  }

  public async fileRead(key: string): Promise<Buffer> {
    try {
      return await this.blob(key).downloadToBuffer();
    } catch (e) {
      NcError._.storageFileReadError(errorMessage(e, this.patchKey(key)));
    }
  }

  public async fileCreate(key: string, file: XcFile): Promise<string> {
    try {
      const blob = this.blob(key);
      await blob.uploadFile(file.path, {
        blobHTTPHeaders: {
          blobContentType: file?.mimetype || 'application/octet-stream',
          blobCacheControl: CACHE_CONTROL,
        },
      });
      return blob.url;
    } catch (e) {
      NcError._.storageFileCreateError(errorMessage(e));
    }
  }

  public async fileCreateByStream(
    key: string,
    stream: Readable,
    options: {
      mimetype?: string;
      size?: number;
    } = {},
  ): Promise<string> {
    try {
      const blob = this.blob(key);
      await blob.uploadStream(stream, undefined, undefined, {
        blobHTTPHeaders: {
          blobContentType: options.mimetype || 'application/octet-stream',
          blobCacheControl: CACHE_CONTROL,
        },
      });
      return blob.url;
    } catch (e) {
      NcError._.storageFileStreamError(errorMessage(e));
    }
  }

  public async fileCreateByUrl(
    destPath: string,
    url: string,
    { fetchOptions: { buffer } = { buffer: false } } = {},
  ): Promise<{ url: string; data: any }> {
    return fetchSourceFile(url, { buffer }, async (response) => {
      try {
        const blob = this.blob(destPath);
        const blobHTTPHeaders = {
          blobContentType: String(
            response.headers['content-type'] || 'application/octet-stream',
          ),
          blobCacheControl: CACHE_CONTROL,
        };

        if (buffer) {
          await blob.uploadData(response.data, { blobHTTPHeaders });
        } else {
          await blob.uploadStream(response.data, undefined, undefined, {
            blobHTTPHeaders,
          });
        }

        return { url: blob.url, data: response.data };
      } catch (e) {
        NcError._.storageFileCreateError(
          `Failed to create file from URL: ${errorMessage(e)}`,
        );
      }
    });
  }

  public async fileDelete(key: string): Promise<void> {
    try {
      await this.blob(key).deleteIfExists();
    } catch (e) {
      NcError._.storageFileDeleteError(errorMessage(e));
    }
  }

  public async fileReadByStream(
    key: string,
    options?: { encoding?: string; start?: number; end?: number },
  ): Promise<Readable> {
    try {
      const offset = options?.start ?? 0;
      const count =
        options?.start !== undefined && options?.end !== undefined
          ? options.end - options.start + 1
          : undefined;

      const response = await this.blob(key).download(offset, count);
      return response.readableStreamBody as Readable;
    } catch (e) {
      NcError._.storageFileStreamError(errorMessage(e, this.patchKey(key)));
    }
  }

  public async fileSize(key: string): Promise<number> {
    try {
      const properties = await this.blob(key).getProperties();
      return Number(properties.contentLength ?? 0);
    } catch (e) {
      NcError._.storageFileReadError(errorMessage(e, this.patchKey(key)));
    }
  }

  public async getDirectoryList(prefix: string): Promise<string[]> {
    try {
      const names: string[] = [];
      for await (const blob of this.containerClient.listBlobsFlat({
        prefix: this.patchKey(prefix),
      })) {
        names.push(path.basename(blob.name));
      }
      return names;
    } catch (e) {
      NcError._.storageFileReadError(
        `Failed to list directory: ${errorMessage(e)}`,
      );
    }
  }

  public async getSignedUrl(
    key: string,
    expiresInSeconds = 7200,
    pathParameters?: { [key: string]: string },
  ): Promise<string> {
    try {
      return await this.blob(key).generateSasUrl({
        permissions: BlobSASPermissions.parse('r'),
        expiresOn: new Date(Date.now() + expiresInSeconds * 1000),
        contentDisposition: pathParameters?.ResponseContentDisposition,
        contentType: pathParameters?.ResponseContentType,
        contentEncoding: pathParameters?.ResponseContentEncoding,
      });
    } catch (e) {
      NcError._.storageFileReadError(
        `Failed to generate signed URL: ${errorMessage(e)}`,
      );
    }
  }

  public async scanFiles(globPattern: string): Promise<Readable> {
    // remove all dots from the glob pattern
    globPattern = globPattern.replace(/\./g, '');

    // remove the leading slash
    globPattern = globPattern.replace(/^\//, '');

    // make sure pattern starts with nc/uploads/
    if (!globPattern.startsWith('nc/uploads/')) {
      globPattern = `nc/uploads/${globPattern}`;
    }

    // Blob listing does not support glob so remove *
    globPattern = globPattern.replace(/\*/g, '');

    const containerClient = this.containerClient;

    // fetch the next page only when the consumer asks for more keys
    async function* listKeys() {
      for await (const blob of containerClient.listBlobsFlat({
        prefix: globPattern,
      })) {
        yield blob.name;
      }
    }

    return Readable.from(listKeys());
  }

  getUploadedPath(key: string): { path?: string; url?: string } {
    return { url: this.blob(key).url };
  }
}
