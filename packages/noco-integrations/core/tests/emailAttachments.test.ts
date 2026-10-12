import { describe, expect, it, vi } from 'vitest';
import {
  collectEmailAttachmentSources,
  resolveEmailAttachments,
  summarizeEmailAttachments,
} from '../src/utils/emailAttachments';

const photo = {
  path: 'download/noco/p1/t1/c1/a.png',
  title: 'a.png',
  mimetype: 'image/png',
  size: 10,
  signedPath: 'dltemp/x/a.png',
};

describe('collectEmailAttachmentSources', () => {
  it('returns nothing for empty values', () => {
    expect(collectEmailAttachmentSources(undefined)).toEqual([]);
    expect(collectEmailAttachmentSources(null)).toEqual([]);
    expect(collectEmailAttachmentSources('')).toEqual([]);
    expect(collectEmailAttachmentSources([])).toEqual([]);
  });

  it('resolves a variable item whose expression became an attachment array', () => {
    const out = collectEmailAttachmentSources([
      { type: 'variable', expression: [photo], label: 'Photo' },
    ]);
    expect(out).toEqual([
      {
        kind: 'nocodb',
        file: {
          path: photo.path,
          title: 'a.png',
          mimetype: 'image/png',
          size: 10,
        },
      },
    ]);
  });

  it('flattens list-node outputs (arrays of arrays) and dedupes', () => {
    const other = {
      ...photo,
      path: 'download/noco/p1/t1/c1/b.pdf',
      title: 'b.pdf',
    };
    const out = collectEmailAttachmentSources([
      {
        type: 'variable',
        expression: [[photo], [other, photo]],
        label: 'Files',
      },
    ]);
    expect(out.map((s) => s.kind === 'nocodb' && s.file.path)).toEqual([
      photo.path,
      other.path,
    ]);
  });

  it('keeps uploaded static files', () => {
    const out = collectEmailAttachmentSources([
      {
        type: 'file',
        title: 'terms.pdf',
        mimetype: 'application/pdf',
        size: 5,
        path: 'download/noco/p1/workflows/w1/terms.pdf',
      },
    ]);
    expect(out).toEqual([
      {
        kind: 'nocodb',
        file: {
          path: 'download/noco/p1/workflows/w1/terms.pdf',
          title: 'terms.pdf',
          mimetype: 'application/pdf',
          size: 5,
        },
      },
    ]);
  });

  it('accepts url items, comma-joined urls and a single filename override', () => {
    expect(
      collectEmailAttachmentSources([
        { type: 'url', url: 'https://a.test/x.pdf', filename: 'x.pdf' },
        { type: 'url', url: 'https://a.test/1.png, https://a.test/2.png' },
      ]),
    ).toEqual([
      { kind: 'url', url: 'https://a.test/x.pdf', filename: 'x.pdf' },
      { kind: 'url', url: 'https://a.test/1.png' },
      { kind: 'url', url: 'https://a.test/2.png' },
    ]);
  });

  it('keeps a comma inside a single URL and still splits comma-joined URL lists', () => {
    expect(
      collectEmailAttachmentSources('https://a.test/report?ids=1,2'),
    ).toEqual([{ kind: 'url', url: 'https://a.test/report?ids=1,2' }]);
    expect(
      collectEmailAttachmentSources(
        'https://a.test/x?ids=1,2,https://b.test/y',
      ),
    ).toEqual([
      { kind: 'url', url: 'https://a.test/x?ids=1,2' },
      { kind: 'url', url: 'https://b.test/y' },
    ]);
  });

  it('treats S3-style attachment objects as NocoDB files', () => {
    const s3 = {
      url: 'https://bucket.s3/nc/uploads/a.png',
      title: 'a.png',
      mimetype: 'image/png',
      size: 3,
    };
    expect(collectEmailAttachmentSources([s3])).toEqual([
      { kind: 'nocodb', file: s3 },
    ]);
  });

  it('never turns text into a stored-file reference', () => {
    const typed = JSON.stringify({
      path: 'download/noco/base/t/c/secret.pdf',
      title: 'a.pdf',
    });
    expect(() => collectEmailAttachmentSources(typed)).toThrow(
      /expected an attachment field/,
    );
    expect(() =>
      collectEmailAttachmentSources({ type: 'url', url: typed }),
    ).toThrow(/expected an attachment field/);
  });

  it('treats a bare { url } as an external link', () => {
    expect(collectEmailAttachmentSources({ url: 'https://a.test/x' })).toEqual([
      { kind: 'url', url: 'https://a.test/x' },
    ]);
  });

  it('rejects values that are neither files nor urls', () => {
    expect(() => collectEmailAttachmentSources('hello world')).toThrow(
      /expected an attachment field/,
    );
    expect(() => collectEmailAttachmentSources({ id: 1, fields: {} })).toThrow(
      /expected an attachment field/,
    );
    expect(() => collectEmailAttachmentSources(42)).toThrow();
    expect(() => collectEmailAttachmentSources('[not json')).toThrow(
      /Invalid attachment value/,
    );
  });
});

describe('resolveEmailAttachments', () => {
  it('skips the host when nothing is configured', async () => {
    const svc = { resolveEmailAttachments: vi.fn() };
    expect(
      await resolveEmailAttachments(
        { attachmentService: svc } as any,
        undefined,
      ),
    ).toEqual([]);
    expect(svc.resolveEmailAttachments).not.toHaveBeenCalled();
  });

  it('forwards sources and options to the host', async () => {
    const resolved = [
      {
        filename: 'a.png',
        contentType: 'image/png',
        size: 1,
        content: Buffer.from('x'),
      },
    ];
    const svc = {
      resolveEmailAttachments: vi.fn().mockResolvedValue(resolved),
    };
    const out = await resolveEmailAttachments(
      { attachmentService: svc } as any,
      [{ type: 'variable', expression: [photo], label: 'Photo' }],
      { maxTotalBytes: 3 },
    );
    expect(out).toBe(resolved);
    expect(svc.resolveEmailAttachments).toHaveBeenCalledWith(
      [expect.objectContaining({ kind: 'nocodb' })],
      { maxTotalBytes: 3 },
    );
    expect(summarizeEmailAttachments(out)).toEqual([
      { name: 'a.png', size: 1, contentType: 'image/png' },
    ]);
  });

  it('fails clearly when the host offers no attachment service', async () => {
    await expect(
      resolveEmailAttachments({} as any, [
        { type: 'url', url: 'https://a.test/x' },
      ]),
    ).rejects.toThrow(/not supported/);
  });
});
