jest.mock('~/utils/ssrf', () => ({
  getFilteredAgents: jest.fn(),
}));

import R2 from './R2';

const config = {
  bucket: 'example-bucket',
  hostname: 'https://account-id.eu.r2.cloudflarestorage.com/',
  access_key: 'test-access-key',
  access_secret: 'test-access-secret',
  region: 'EU',
};

describe('R2', () => {
  it('builds virtual-hosted URLs with the configured jurisdiction', () => {
    const adapter = new R2(config);
    const url = adapter.getUploadedPath('nc/uploads/path/video.mp4').url;

    expect(url).toBe(
      'https://example-bucket.account-id.eu.r2.cloudflarestorage.com/nc/uploads/path/video.mp4',
    );
    expect(
      adapter.getUploadedPath('example-bucket/nc/uploads/path/video.mp4').url,
    ).toBe(url);
  });

  it('normalizes old path-style upload locations', () => {
    const adapter = new R2(config);
    const oldLocation =
      'https://account-id.r2.cloudflarestorage.com/example-bucket/nc/uploads/path/video.mp4';

    expect((adapter as any).patchUploadReturnKey(oldLocation)).toBe(
      'https://example-bucket.account-id.eu.r2.cloudflarestorage.com/nc/uploads/path/video.mp4',
    );
  });

  it('removes the bucket from path-style keys before S3 operations', () => {
    const adapter = new R2(config);

    expect(
      (adapter as any).patchKey(
        'https://account-id.eu.r2.cloudflarestorage.com/example-bucket/nc/uploads/video.mp4',
      ),
    ).toBe('nc/uploads/video.mp4');
    expect(
      (adapter as any).patchKey(
        'https://example-bucket.account-id.eu.r2.cloudflarestorage.com/nc/uploads/video.mp4',
      ),
    ).toBe('nc/uploads/video.mp4');
    expect((adapter as any).patchKey('nc/uploads/video.mp4')).toBe(
      'nc/uploads/video.mp4',
    );
  });

  it('keeps malformed percent-encoding readable as a raw key', () => {
    const adapter = new R2(config);

    expect((adapter as any).patchKey('nc/uploads/bad%key.mp4')).toBe(
      'nc/uploads/bad%key.mp4',
    );
  });
});
