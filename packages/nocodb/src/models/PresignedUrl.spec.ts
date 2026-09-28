const store = new Map<string, any>();
const getSignedUrlMock = jest.fn(
  async (path: string, _expires: number, params: Record<string, string>) =>
    `https://bucket/${path}?sig=${getSignedUrlMock.mock.calls.length}&exp=${params.expireAt}`,
);
let externalStorage = true;

jest.mock('~/Noco', () => ({ __esModule: true, default: { ncMeta: {} } }));
jest.mock('~/cache/NocoCache', () => ({
  __esModule: true,
  default: {
    get: jest.fn(async (_ctx, key) => store.get(key) ?? null),
    setExpiring: jest.fn(async (_ctx, key, value) => {
      store.set(key, JSON.parse(JSON.stringify(value)));
    }),
    del: jest.fn(async (_ctx, key) => {
      store.delete(key);
    }),
  },
}));
jest.mock('~/helpers/NcPluginMgrv2', () => ({
  __esModule: true,
  default: {
    storageAdapter: jest.fn(async () =>
      externalStorage ? { getSignedUrl: getSignedUrlMock } : {},
    ),
  },
}));
jest.mock('~/helpers/attachmentHelpers', () => ({
  getPathFromUrl: (url: string) => new URL(url).pathname,
  isPreviewAllowed: () => true,
}));

import PresignedUrl from './PresignedUrl';

const MIN = 60 * 1000;

describe('PresignedUrl.getSignedUrl', () => {
  beforeEach(() => {
    store.clear();
    getSignedUrlMock.mockClear();
    externalStorage = true;
    jest.useFakeTimers({ now: new Date('2026-09-28T10:00:00.000Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reuses the signed url across 10-minute slot boundaries', async () => {
    const first = await PresignedUrl.getSignedUrl({ pathOrUrl: 'nc/a.png' });
    jest.advanceTimersByTime(11 * MIN);
    const second = await PresignedUrl.getSignedUrl({ pathOrUrl: 'nc/a.png' });
    jest.advanceTimersByTime(30 * MIN);
    const third = await PresignedUrl.getSignedUrl({ pathOrUrl: 'nc/a.png' });

    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
  });

  it('re-signs once less than half of the requested lifetime is left', async () => {
    const first = await PresignedUrl.getSignedUrl({
      pathOrUrl: 'nc/a.png',
      expireSeconds: 60 * 60,
    });
    jest.advanceTimersByTime(35 * MIN);
    const second = await PresignedUrl.getSignedUrl({
      pathOrUrl: 'nc/a.png',
      expireSeconds: 60 * 60,
    });

    expect(second).not.toBe(first);
    expect(getSignedUrlMock).toHaveBeenCalledTimes(2);
  });

  it('keeps separate entries per lifetime and response params', async () => {
    await PresignedUrl.getSignedUrl({ pathOrUrl: 'nc/a.png' });
    await PresignedUrl.getSignedUrl({
      pathOrUrl: 'nc/a.png',
      expireSeconds: 5 * 60,
    });
    await PresignedUrl.getSignedUrl({ pathOrUrl: 'nc/a.png', preview: true });
    await PresignedUrl.getSignedUrl({
      pathOrUrl: 'nc/a.png',
      filename: 'b.png',
    });

    expect(getSignedUrlMock).toHaveBeenCalledTimes(4);
  });

  it('caches local dltemp urls and resolves them back to the path', async () => {
    externalStorage = false;
    const first = await PresignedUrl.getSignedUrl({
      pathOrUrl: 'nc/uploads/a.png',
      filename: 'a.png',
    });
    jest.advanceTimersByTime(11 * MIN);
    const second = await PresignedUrl.getSignedUrl({
      pathOrUrl: 'nc/uploads/a.png',
      filename: 'a.png',
    });

    expect(second).toBe(first);
    expect(first).toMatch(/^dltemp\//);

    const fullPath = await PresignedUrl.getPath(first);
    const [filePath, query] = fullPath.split('?');
    const params = new URLSearchParams(query);
    expect(filePath).toBe('nc/uploads/a.png');
    expect(params.has('expireAt')).toBe(false);
    expect(params.get('ResponseContentDisposition')).toContain('attachment');
  });
});
