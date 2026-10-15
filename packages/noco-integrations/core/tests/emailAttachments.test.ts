import { describe, expect, it, vi } from 'vitest';
import {
  assertPlatformMailerAttachments,
  collectEmailAttachmentSources,
  resolveEmailAttachments,
  resolveEmailBodyImages,
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
        origin: 'record',
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
        origin: 'upload',
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
      { kind: 'nocodb', origin: 'record', file: s3 },
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

  it('never turns a url item into a stored-file reference', () => {
    expect(() =>
      collectEmailAttachmentSources({
        type: 'url',
        url: { path: 'download/noco/base/t/c/secret.pdf', title: 'a.pdf' },
      }),
    ).toThrow(/expected a URL/);
    expect(
      collectEmailAttachmentSources({
        type: 'url',
        url: [{ url: 'https://a.test/x.pdf', title: 'x.pdf', size: 1 }],
      }),
    ).toEqual([{ kind: 'url', url: 'https://a.test/x.pdf' }]);
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

describe('assertPlatformMailerAttachments', () => {
  const file = (filename: string, contentType: string) => ({
    filename,
    contentType,
    size: 1,
    content: Buffer.from('x'),
  });

  it('allows documents and images', () => {
    expect(() =>
      assertPlatformMailerAttachments([
        file('report.pdf', 'application/pdf'),
        file('photo.PNG', 'image/png'),
        file('notes', 'text/plain'),
      ]),
    ).not.toThrow();
  });

  it('refuses executables and web pages by extension or content type', () => {
    for (const blocked of [
      file('setup.EXE', 'application/octet-stream'),
      file('invoice.html', 'application/octet-stream'),
      file('logo.svg', 'image/svg+xml'),
      file('page', 'Text/HTML; charset=utf-8'),
      file('cert.crt', 'application/octet-stream'),
      file('data.mdb', 'application/octet-stream'),
    ]) {
      expect(() => assertPlatformMailerAttachments([blocked])).toThrow(
        /built-in mailer/,
      );
    }
  });

  it('sees through trailing dots, spaces and control characters', () => {
    for (const name of ['setup.exe.', 'invoice.html ', 'run.bat. . ', 'x.exe\u0000']) {
      expect(() =>
        assertPlatformMailerAttachments([file(name, 'application/octet-stream')]),
      ).toThrow(/built-in mailer/);
    }
  });
});

describe('resolveEmailBodyImages', () => {
  const body =
    '<p><img src="nc-file:download/noco/b1/workflows/w1/logo_ab12c.png">' +
    '<img src="nc-file:download/noco/b1/workflows/w1/logo_ab12c.png">' +
    '<img src="nc-file:https://s3.test/a.svg?x=1&amp;y=2"></p>';

  it('does not touch the host for bodies without stored images', async () => {
    const resolve = vi.fn();
    const map = await resolveEmailBodyImages(
      { attachmentService: { resolveEmailAttachments: resolve } } as any,
      '<p><img src="data:image/png;base64,AAAA"></p>',
    );
    expect(map.size).toBe(0);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('loads each supported image once, one file per call', async () => {
    const content = Buffer.from('png');
    const resolve = vi.fn().mockResolvedValue([
      { filename: 'logo.png', contentType: 'application/octet-stream', size: 3, content },
    ]);
    const map = await resolveEmailBodyImages(
      { attachmentService: { resolveEmailAttachments: resolve } } as any,
      body,
    );
    // SVG is skipped before the host is asked; the duplicate is asked for once.
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith(
      [{ kind: 'nocodb', origin: 'upload', file: { path: 'download/noco/b1/workflows/w1/logo_ab12c.png' } }],
      { maxFiles: 1, maxTotalBytes: 2 * 1024 * 1024 },
    );
    expect(map.get('download/noco/b1/workflows/w1/logo_ab12c.png')).toEqual({
      content,
      contentType: 'image/png',
    });
  });

  it('leaves out an image it cannot load and reports it, keeping the rest', async () => {
    const content = Buffer.from('png');
    const resolve = vi
      .fn()
      .mockRejectedValueOnce(new Error('not accessible from this base'))
      .mockResolvedValueOnce([{ filename: 'b.png', contentType: 'x', size: 3, content }]);
    const onSkip = vi.fn();
    const map = await resolveEmailBodyImages(
      { attachmentService: { resolveEmailAttachments: resolve } } as any,
      '<img src="nc-file:download/w/a/gone.png"><img src="nc-file:download/w/b/b.png">',
      { onSkip },
    );
    expect([...map.keys()]).toEqual(['download/w/b/b.png']);
    expect(onSkip).toHaveBeenCalledWith('gone.png', 'not accessible from this base');
  });

  it('rejects bodies with more images than an email may carry', async () => {
    const many = Array.from({ length: 11 }, (_, i) => `<img src="nc-file:a/${i}.png">`).join('');
    await expect(
      resolveEmailBodyImages({ attachmentService: { resolveEmailAttachments: vi.fn() } } as any, many),
    ).rejects.toThrow(/more than 10 images/);
  });

  it('fails loudly where no attachment service exists', async () => {
    await expect(resolveEmailBodyImages({} as any, body)).rejects.toThrow(
      /not supported/,
    );
  });
});
