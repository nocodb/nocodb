jest.mock('~/utils/ssrf', () => ({
  getFilteredAgents: jest.fn(),
}));
// getPathFromUrl() is a pure function; stub the heavy/ESM-only modules its
// file pulls in so the suite does not have to boot the app.
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'x1y2z'),
  customAlphabet: jest.fn(() => () => 'x1y2z'),
}));
jest.mock('~/helpers/NcPluginMgrv2', () => ({}));
jest.mock('~/models', () => ({}));
jest.mock('~/utils', () => ({}));

import { Readable } from 'stream';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import LinodeObjectStorage from '~/plugins/linode/LinodeObjectStorage';
import OvhCloud from '~/plugins/ovhCloud/OvhCloud';
import ScalewayObjectStorage from '~/plugins/scaleway/ScalewayObjectStorage';
import UpoCloud from '~/plugins/upcloud/UpoCloud';
import Vultr from '~/plugins/vultr/Vultr';
import { getPathFromUrl } from '~/helpers/attachmentHelpers';

const credentials = {
  bucket: 'nc-bucket',
  region: 'eu-central-1',
  access_key: 'test-access-key',
  access_secret: 'test-access-secret',
};

// Every adapter here inherits GenericS3.upload(), which hands back the
// `Location` computed by @aws-sdk/lib-storage.
const adapters = [
  ['LinodeObjectStorage', () => new LinodeObjectStorage(credentials)],
  ['OvhCloud', () => new OvhCloud(credentials)],
  ['ScalewayObjectStorage', () => new ScalewayObjectStorage(credentials)],
  [
    'UpoCloud',
    () =>
      new UpoCloud({ ...credentials, endpoint: 'abcde.upcloudobjects.com' }),
  ],
  [
    'Vultr',
    () =>
      new Vultr({ ...credentials, hostname: 'https://ams1.vultrobjects.com' }),
  ],
] as const;

// Attachment keys keep the uploaded file name (see normalizeFilename), so
// spaces and other URL-unsafe characters reach the storage key as-is.
const keys = [
  'nc/uploads/2026/02/26/abc/report_x1y2z.pdf',
  'nc/uploads/2026/02/26/abc/quarterly report_x1y2z.pdf',
  'nc/uploads/2026/02/26/abc/Invoice (final), v2 & notes+1_x1y2z.pdf',
  'nc/uploads/2026/02/26/abc/résumé 2026_x1y2z.pdf',
];

describe.each(adapters)('%s attachment keys', (_name, createAdapter) => {
  let adapter: ReturnType<(typeof adapters)[number][1]>;
  let sent: any[];

  beforeEach(async () => {
    adapter = createAdapter();
    await adapter.init();
    sent = [];
    // Stub only the network round trip; the S3 client, lib-storage and
    // the adapter's own URL/key handling all run for real.
    jest
      .spyOn((adapter as any).s3Client, 'send')
      .mockImplementation(async (command: any) => {
        sent.push(command);
        if (command instanceof GetObjectCommand) {
          return { Body: Readable.from([Buffer.from('file-body')]) };
        }
        return { ETag: '"etag"' };
      });
  });

  afterEach(() => jest.restoreAllMocks());

  it.each(keys)(
    'returns an upload url that resolves back to the stored key: %s',
    async (key) => {
      const url = await adapter.fileCreateByStream(
        key,
        Readable.from([Buffer.from('file-body')]),
        { mimetype: 'application/pdf' },
      );

      const put = sent.find((c) => c instanceof PutObjectCommand);
      expect(put.input.Key).toBe(key);

      // PresignedUrl.getSignedUrl() and the attachment readers derive the
      // object key from the stored url exactly like this.
      const derivedKey = getPathFromUrl(url).replace(/^\/+/, '');
      expect(derivedKey).toBe(key);

      // Reading the file back must request the object that was uploaded,
      // not a percent-encoded copy of its name (NoSuchKey).
      await adapter.fileReadByStream(derivedKey);
      const get = sent.find((c) => c instanceof GetObjectCommand);
      expect(get.input.Key).toBe(key);

      // The signed download url must point at the same object.
      const signed = await adapter.getSignedUrl(derivedKey, 600);
      expect(decodeURIComponent(new URL(signed).pathname)).toMatch(
        new RegExp(`/${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
      );
    },
  );
});

describe('GenericS3 upload location', () => {
  const adapter = new LinodeObjectStorage(credentials) as any;

  it('decodes the key segments of a path-style location', () => {
    expect(
      adapter.patchUploadReturnKey(
        'https://eu-central-1.linodeobjects.com/nc-bucket/nc/uploads/my%20file%2C%20v2.pdf',
      ),
    ).toBe(
      'https://eu-central-1.linodeobjects.com/nc-bucket/nc/uploads/my file, v2.pdf',
    );
  });

  it('leaves an already decoded location unchanged', () => {
    const location =
      'https://nc-bucket.eu-central-1.linodeobjects.com/nc/uploads/my file.pdf';
    expect(adapter.patchUploadReturnKey(location)).toBe(location);
  });

  it('keeps a segment with malformed percent-encoding as-is', () => {
    expect(
      adapter.patchUploadReturnKey(
        'https://nc-bucket.eu-central-1.linodeobjects.com/nc%2Fuploads/100%_done.pdf',
      ),
    ).toBe(
      'https://nc-bucket.eu-central-1.linodeobjects.com/nc/uploads/100%_done.pdf',
    );
  });

  it('passes through values that are not absolute urls', () => {
    expect(adapter.patchUploadReturnKey('nc/uploads/a%20b.pdf')).toBe(
      'nc/uploads/a%20b.pdf',
    );
    expect(adapter.patchUploadReturnKey(undefined)).toBeUndefined();
  });
});
