import { describe, it, expect } from 'vitest';
import {
  collectEmailBodyImageRefs,
  EMAIL_BASE_STYLES,
  EMAIL_BODY_STYLE,
  emailImageTypeForFile,
  extractInlineImages,
  htmlToPlainText,
  isLikelyHtml,
  MAX_EMAIL_HTML_BODY_LENGTH,
  MAX_EMAIL_INLINE_IMAGES,
  MAX_EMAIL_INLINE_IMAGES_SIZE,
  prepareEmailBody,
  sanitizeEmailHtml,
  sanitizeInlineStyle,
} from '../src/utils/emailBody';

describe('isLikelyHtml', () => {
  it('detects rich-text bodies', () => {
    expect(isLikelyHtml('<p>Hi</p>')).toBe(true);
    expect(isLikelyHtml('<h2>Title</h2>')).toBe(true);
  });

  it('does not promote plain text whose first word merely starts like a tag', () => {
    // `\b` matched these, and promoting them deletes the bracketed text: the sanitizer drops
    // the unknown tag, so the recipient loses it entirely.
    expect(isLikelyHtml('<pre-approved offer inside> Dear customer')).toBe(false);
    expect(isLikelyHtml('<p.s. read this> body')).toBe(false);
    expect(isLikelyHtml("<ol' fashioned> greeting")).toBe(false);
    expect(isLikelyHtml('<h1-hour sale> today only')).toBe(false);
    expect(isLikelyHtml('<div-ish thing> text')).toBe(false);
  });

  it('still detects every shape the editor emits', () => {
    expect(isLikelyHtml('<p/>')).toBe(true);
    expect(isLikelyHtml('<p style="margin: 0">x</p>')).toBe(true);
    expect(isLikelyHtml('   <blockquote>q</blockquote>')).toBe(true);
    expect(isLikelyHtml('<div>d</div>')).toBe(true);
  });

  it('keeps legacy plain text (even with tag-like content) as text', () => {
    expect(isLikelyHtml('Hello,\nline two')).toBe(false);
    expect(isLikelyHtml('a < b and b > c')).toBe(false);
    expect(isLikelyHtml('if a<b and c>d')).toBe(false);
    expect(isLikelyHtml('Total: 5<b>')).toBe(false);
    expect(isLikelyHtml('Hi <strong>there</strong>')).toBe(false);
    expect(isLikelyHtml('')).toBe(false);
  });
});

describe('prepareEmailBody', () => {
  it('passes legacy plain text through untouched', () => {
    const r = prepareEmailBody('Hi,\n\nThanks', { isHtml: false });
    expect(r).toEqual({ isHtml: false, text: 'Hi,\n\nThanks' });
  });

  it('sends rich text as html with a text fallback', () => {
    const r = prepareEmailBody('<p>Hi <strong>there</strong></p><ul><li>one</li><li>two</li></ul>', {
      isHtml: true,
    });
    expect(r.isHtml).toBe(true);
    expect(r.html).toBe(
      `<div style="${EMAIL_BODY_STYLE}">` +
        `<p style="${EMAIL_BASE_STYLES.p}">Hi <strong>there</strong></p>` +
        `<ul style="${EMAIL_BASE_STYLES.ul}"><li style="${EMAIL_BASE_STYLES.li}">one</li><li style="${EMAIL_BASE_STYLES.li}">two</li></ul>` +
        '</div>',
    );
    expect(r.text).toBe('Hi there\n- one\n- two');
  });

  it('does not add paragraph margins inside list items', () => {
    const r = prepareEmailBody('<ul><li><p>one</p></li></ul>', { isHtml: true });
    expect(r.html).toContain(`<li style="${EMAIL_BASE_STYLES.li}"><p>one</p></li>`);
  });

  it('inlines base styles under the author\'s own', () => {
    const r = prepareEmailBody('<h1 style="color: #dc2626">T</h1>', { isHtml: true });
    expect(r.html).toContain(`<h1 style="${EMAIL_BASE_STYLES.h1}; color: #dc2626">T</h1>`);
  });

  it('mirrors text-align to the align attribute for Outlook', () => {
    const r = prepareEmailBody('<p style="text-align: center">x</p>', { isHtml: true });
    expect(r.html).toContain(`<p style="${EMAIL_BASE_STYLES.p}; text-align: center" align="center">x</p>`);
  });

  it('keeps font-family and font-size spans', () => {
    const r = prepareEmailBody(
      `<p><span style="font-family: Georgia, 'Times New Roman', serif; font-size: 18px">x</span></p>`,
      { isHtml: true },
    );
    expect(r.html).toContain(`<span style="font-family: Georgia, 'Times New Roman', serif; font-size: 18px">x</span>`);
  });

  it('does not leak base styles into a raw sanitize', () => {
    expect(sanitizeEmailHtml('<p>x</p>')).toBe('<p>x</p>');
  });

  it('never sniffs: a plain-mode body that looks like html stays text', () => {
    // The P0 seam: a template starting with `{{ }}` is plain, so the backend does not escape
    // the interpolated value. If that value happens to start with a block tag, sniffing here
    // would route unescaped record markup into the HTML part.
    const body = '<p>from a record</p>\n\nRegards';
    expect(prepareEmailBody(body, { isHtml: false })).toEqual({ isHtml: false, text: body });
  });

  it('stringifies non-string values', () => {
    expect(prepareEmailBody(null, { isHtml: false }).text).toBe('');
    expect(prepareEmailBody(42, { isHtml: false }).text).toBe('42');
    expect(prepareEmailBody({ a: 1 }, { isHtml: false }).text).toBe('{"a":1}');
  });
});

describe('sanitizeEmailHtml', () => {
  it('strips scripts, handlers, iframes and images', () => {
    const html =
      '<p onclick="x()">Hi <script>alert(1)</script><strong>there</strong></p>' +
      '<iframe src="https://evil.example"></iframe><img src=x onerror="x()">';
    expect(sanitizeEmailHtml(html)).toBe('<p>Hi <strong>there</strong></p>');
  });

  it('keeps http(s)/mailto links and drops other schemes', () => {
    expect(sanitizeEmailHtml('<a href="https://ok.example" target="_blank" rel="noopener">ok</a>')).toBe(
      '<a href="https://ok.example" target="_blank" rel="noopener">ok</a>',
    );
    expect(sanitizeEmailHtml('<a href="mailto:a@b.c">m</a>')).toBe('<a href="mailto:a@b.c">m</a>');
    expect(sanitizeEmailHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
  });

  it('adds a scheme to hrefs that resolved without one', () => {
    expect(sanitizeEmailHtml('<a href="nocodb.com/x">x</a>')).toBe('<a href="https://nocodb.com/x">x</a>');
    expect(sanitizeEmailHtml('<a href=" localhost:8080 ">x</a>')).toBe('<a href="https://localhost:8080">x</a>');
    expect(sanitizeEmailHtml('<a href="//cdn.example">x</a>')).toBe('<a href="https://cdn.example">x</a>');
    expect(sanitizeEmailHtml('<a href="a@b.com">x</a>')).toBe('<a href="mailto:a@b.com">x</a>');
    expect(sanitizeEmailHtml('<a href="https://ok.example">x</a>')).toBe('<a href="https://ok.example">x</a>');
    expect(sanitizeEmailHtml('<a href="example.com:8080/a">x</a>')).toBe('<a href="https://example.com:8080/a">x</a>');
    expect(sanitizeEmailHtml('<a href="tel:123">x</a>')).toBe('<a>x</a>');
    expect(sanitizeEmailHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
  });

  it('keeps whitelisted inline styles only', () => {
    expect(sanitizeEmailHtml('<span style="color: #dc2626">red</span>')).toBe(
      '<span style="color: #dc2626">red</span>',
    );
    expect(sanitizeEmailHtml('<span style="background-color: #fef08a; position: fixed">hl</span>')).toBe(
      '<span style="background-color: #fef08a">hl</span>',
    );
    expect(sanitizeEmailHtml('<p style="background-image: url(https://t.example/p.gif)">x</p>')).toBe('<p>x</p>');
    expect(sanitizeEmailHtml('<p style="color: url(https://t.example)">x</p>')).toBe('<p>x</p>');
  });

  it('drops data attributes emitted by the editor', () => {
    expect(sanitizeEmailHtml('<span data-text-color="#dc2626" style="color: #dc2626">r</span>')).toBe(
      '<span style="color: #dc2626">r</span>',
    );
  });
});

describe('sanitizeInlineStyle', () => {
  it('normalises and filters declarations', () => {
    expect(sanitizeInlineStyle('COLOR:#fff;font-size: 14px ; behavior: url(x.htc); ')).toBe(
      'color: #fff; font-size: 14px',
    );
    expect(sanitizeInlineStyle('font-family: Georgia, "Times New Roman", serif')).toBe(
      'font-family: Georgia, "Times New Roman", serif',
    );
    expect(sanitizeInlineStyle('color: expression(alert(1))')).toBe('');
    expect(sanitizeInlineStyle('color: red\\9')).toBe('');
  });
});

describe('htmlToPlainText', () => {
  it('turns block structure into lines and decodes entities', () => {
    expect(htmlToPlainText('<h1>T</h1><p>a&amp;b</p><blockquote>q</blockquote><p>x<br>y</p>')).toBe(
      'T\na&b\nq\nx\ny',
    );
  });

  it('keeps the href, which a plain-text reader has no other way to reach', () => {
    expect(htmlToPlainText('<p><a href="https://example.com/x">link text</a></p>')).toBe(
      'link text (https://example.com/x)',
    );
    expect(htmlToPlainText('<p><a href="mailto:a@b.com">mail</a></p>')).toBe('mail (a@b.com)');
  });

  it('does not repeat a url that is already the label', () => {
    expect(htmlToPlainText('<p><a href="https://example.com">https://example.com</a></p>')).toBe(
      'https://example.com',
    );
  });

  it('numbers ordered items and bullets unordered ones', () => {
    expect(htmlToPlainText('<ol><li><p>first</p></li><li><p>second</p></li></ol>')).toBe(
      '1. first\n2. second',
    );
    expect(htmlToPlainText('<ul><li><p>one</p></li><li><p>two</p></li></ul>')).toBe('- one\n- two');
  });

  it('indents nested lists and keeps the outer numbering', () => {
    expect(
      htmlToPlainText(
        '<ol><li><p>outer1</p><ol><li><p>inner-a</p></li><li><p>inner-b</p></li></ol></li><li><p>outer2</p></li></ol>',
      ),
    ).toBe('1. outer1\n  1. inner-a\n  2. inner-b\n2. outer2');
  });

  it('nests a bullet list inside an ordered item', () => {
    expect(htmlToPlainText('<ol><li>a<ul><li>b</li></ul></li></ol>')).toBe('1. a\n  - b');
  });

  it('keeps a sub-list authored as a sibling of the items', () => {
    // Legacy WYSIWYG output puts the nested list beside the <li>s rather than inside one.
    // Skipping non-LI children dropped b and c while the HTML part kept them.
    expect(
      htmlToPlainText('<ul><li>a</li><ul><li>b</li><li>c</li></ul><li>d</li></ul>'),
    ).toBe('- a\n  - b\n  - c\n- d');
  });

  it('keeps div-structured bodies on separate lines', () => {
    expect(htmlToPlainText('<div>one</div><div>two</div>')).toBe('one\ntwo');
  });

  it('indents two levels of nesting by one step each', () => {
    expect(
      htmlToPlainText('<ul><li>a<ul><li>b<ul><li>c</li></ul></li></ul></li></ul>'),
    ).toBe('- a\n  - b\n    - c');
  });
});

describe('body size cap', () => {
  it('rejects oversized html before it reaches the sanitizer', () => {
    const huge = '<p>' + 'x'.repeat(MAX_EMAIL_HTML_BODY_LENGTH) + '</p>';
    expect(() => prepareEmailBody(huge, { isHtml: true })).toThrow(/100 KB limit/);
  });

  it('leaves oversized plain text alone', () => {
    const text = 'x'.repeat(MAX_EMAIL_HTML_BODY_LENGTH + 1);
    expect(prepareEmailBody(text, { isHtml: false })).toEqual({ isHtml: false, text });
  });
});

describe('inline images', () => {
  const PNG = Buffer.from('fake-png-bytes').toString('base64');
  const logo = (alt = 'Acme') => `<img src="data:image/png;base64,${PNG}" alt="${alt}" width="120">`;

  it('turns data: images into cid parts the html references', () => {
    const r = prepareEmailBody(`<p>Thanks</p><p>${logo()}</p>`, { isHtml: true });
    expect(r.inlineImages).toHaveLength(1);
    const [image] = r.inlineImages!;
    expect(image).toMatchObject({ cid: 'image1@nocodb', filename: 'image1.png', contentType: 'image/png' });
    expect(image.content.toString()).toBe('fake-png-bytes');
    expect(r.html).toContain('<img src="cid:image1@nocodb" alt="Acme" width="120">');
    expect(r.html).not.toContain('data:');
  });

  it('keeps the plain-text part free of image artefacts', () => {
    const r = prepareEmailBody(`<p>Jane Doe</p><p>${logo()}</p><p>Acme Inc.</p>`, { isHtml: true });
    expect(r.text).toBe('Jane Doe\n\nAcme Inc.');
  });

  it('shares one part between identical images', () => {
    const r = prepareEmailBody(`<p>${logo()}${logo('again')}</p>`, { isHtml: true });
    expect(r.inlineImages).toHaveLength(1);
    expect(r.html!.match(/cid:image1@nocodb/g)).toHaveLength(2);
  });

  it('drops remote, data: svg and unknown cid sources with their img', () => {
    expect(sanitizeEmailHtml('<p>a<img src="https://t.example/p.gif">b</p>')).toBe('<p>ab</p>');
    expect(sanitizeEmailHtml('<p><img src="cid:forged@x"></p>')).toBe('<p></p>');
    expect(sanitizeEmailHtml('<p><img src="data:image/png;base64,AAAA"></p>')).toBe('<p></p>');
    const svg = `<p><img src="data:image/svg+xml;base64,${PNG}"></p>`;
    const r = prepareEmailBody(svg, { isHtml: true });
    expect(r.inlineImages).toEqual([]);
    expect(r.html).not.toContain('<img');
  });

  it('never allows a cid: link', () => {
    expect(sanitizeEmailHtml('<a href="cid:x">x</a>', { inlineCids: ['x'] })).toBe('<a>x</a>');
  });

  it('leaves bodies without images unchanged', () => {
    const r = prepareEmailBody('<p>Hi</p>', { isHtml: true });
    expect(r.inlineImages).toEqual([]);
    expect(r.html).toBe(`<div style="${EMAIL_BODY_STYLE}"><p style="${EMAIL_BASE_STYLES.p}">Hi</p></div>`);
  });

  it('does not count image bytes against the markup limit', () => {
    const big = Buffer.alloc(200_000, 1).toString('base64');
    const r = prepareEmailBody(`<p><img src="data:image/jpeg;base64,${big}"></p>`, { isHtml: true });
    expect(r.inlineImages![0].content.length).toBe(200_000);
  });

  it('rejects too many or too large images with an actionable error', () => {
    const many = Array.from(
      { length: MAX_EMAIL_INLINE_IMAGES + 1 },
      (_, i) => `<img src="data:image/png;base64,${Buffer.from(`img-${i}`).toString('base64')}">`,
    ).join('');
    expect(() => extractInlineImages(`<p>${many}</p>`)).toThrow(/more than 10 images/);

    const huge = Buffer.alloc(MAX_EMAIL_INLINE_IMAGES_SIZE + 1, 1).toString('base64');
    expect(() => extractInlineImages(`<p><img src="data:image/png;base64,${huge}"></p>`)).toThrow(
      /exceed the 2 MB limit\. Use smaller images/,
    );
  });
});

describe('stored body images', () => {
  const ref = 'download/noco/b1/workflows/w1/logo_ab12c.png';
  const html = `<p>Hi</p><p><img src="nc-file:${ref}" alt="Logo" width="120"><img src="nc-file:${ref}"></p>`;

  it('lists each referenced file once', () => {
    expect(collectEmailBodyImageRefs(html)).toEqual([ref]);
    expect(collectEmailBodyImageRefs('<p>no images</p>')).toEqual([]);
  });

  it('turns resolved files into one shared cid part', () => {
    const content = Buffer.from('png');
    const r = prepareEmailBody(html, {
      isHtml: true,
      images: new Map([[ref, { content, contentType: 'image/png' }]]),
    });
    expect(r.html).not.toContain('nc-file:');
    expect(r.html!.match(/src="cid:image1@nocodb"/g)).toHaveLength(2);
    expect(r.inlineImages).toEqual([
      { cid: 'image1@nocodb', filename: 'image1.png', contentType: 'image/png', content },
    ]);
  });

  it('drops images whose bytes were not loaded', () => {
    const r = prepareEmailBody(html, { isHtml: true });
    expect(r.html).not.toContain('<img');
    expect(r.inlineImages).toEqual([]);
  });

  it('rejects an oversized body before scanning it for images', () => {
    const hostile = '<img '.repeat(200_000);
    const started = Date.now();
    expect(() => prepareEmailBody(hostile, { isHtml: true })).toThrow(/KB limit/);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('counts a base64 run outside an image source as markup', () => {
    const run = `<p>data:image/png;base64,${'A'.repeat(200_000)}</p>`;
    expect(() => prepareEmailBody(run, { isHtml: true })).toThrow(/KB limit/);
    const image = `<p><img src="data:image/png;base64,${'A'.repeat(200_000)}"></p>`;
    expect(() => prepareEmailBody(image, { isHtml: true })).not.toThrow(/KB limit/);
  });

  it('counts a src= payload outside an img, or of a type never sent, as markup', () => {
    // Record values can't form `<img`, but they may carry `src='data:…'` as text.
    const fromRecord = `<p>x src='data:image/png;base64,${'A'.repeat(200_000)}'</p>`;
    expect(() => prepareEmailBody(fromRecord, { isHtml: true })).toThrow(/KB limit/);
    const bmp = `<p><img src="data:image/bmp;base64,${'A'.repeat(200_000)}"></p>`;
    expect(() => prepareEmailBody(bmp, { isHtml: true })).toThrow(/KB limit/);
  });

  it('caps image payloads that decode to nothing too', () => {
    const empty = `<p><img src="data:image/png;base64,${'='.repeat(3_000_000)}"></p>`;
    expect(() => prepareEmailBody(empty, { isHtml: true })).toThrow(/exceed the 2 MB limit/);
  });

  it('scans hostile bodies for references in bounded time', () => {
    // Under the markup cap, so the scan really runs and only the regex bounds keep it cheap.
    const cases = [
      'nc-file:' + '<img '.repeat(400) + ' src=' + ' '.repeat(95_000),
      'nc-file:' + '<img '.repeat(19_000),
      'nc-file:' + '<img '.repeat(400) + ' src="nc-file:' + 'a'.repeat(90_000),
    ];
    for (const body of cases) {
      expect(body.length).toBeLessThan(MAX_EMAIL_HTML_BODY_LENGTH);
      const started = Date.now();
      collectEmailBodyImageRefs(body);
      expect(Date.now() - started).toBeLessThan(500);
    }
  });

  it('counts an unclosed data: src as markup, so the cap stops it before extraction', () => {
    const unclosed = '<p>' + '<img '.repeat(400) + ' src="data:image/png;base64,' + 'A'.repeat(1_000_000);
    const started = Date.now();
    expect(() => prepareEmailBody(unclosed, { isHtml: true })).toThrow(/KB limit/);
    expect(Date.now() - started).toBeLessThan(500);

    const closed = `<p><img src="data:image/png;base64,${'A'.repeat(200_000)}"></p>`;
    expect(() => prepareEmailBody(closed, { isHtml: true })).not.toThrow(/KB limit/);
  });

  it('stays fast at the markup cap', () => {
    const atCap = '<img '.repeat(19_000);
    const started = Date.now();
    prepareEmailBody(atCap, { isHtml: true });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('types files by extension and skips the rest', () => {
    expect(emailImageTypeForFile('a/b/logo.JPG')).toBe('image/jpeg');
    expect(emailImageTypeForFile('https://s3.test/a.webp?sig=1')).toBe('image/webp');
    expect(emailImageTypeForFile('a/b/photo_ab12c.jfif')).toBe('image/jpeg');
    expect(emailImageTypeForFile('a/b/logo.svg')).toBeUndefined();
  });
});
