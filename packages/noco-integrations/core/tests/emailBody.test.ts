import { describe, it, expect } from 'vitest';
import {
  EMAIL_BASE_STYLES,
  EMAIL_BODY_STYLE,
  htmlToPlainText,
  isLikelyHtml,
  prepareEmailBody,
  sanitizeEmailHtml,
  sanitizeInlineStyle,
} from '../src/utils/emailBody';

describe('isLikelyHtml', () => {
  it('detects rich-text bodies', () => {
    expect(isLikelyHtml('<p>Hi</p>')).toBe(true);
    expect(isLikelyHtml('<h2>Title</h2>')).toBe(true);
    expect(isLikelyHtml('Hi <strong>there</strong>')).toBe(true);
  });

  it('keeps legacy plain text (even with angle brackets) as text', () => {
    expect(isLikelyHtml('Hello,\nline two')).toBe(false);
    expect(isLikelyHtml('a < b and b > c')).toBe(false);
    expect(isLikelyHtml('')).toBe(false);
  });
});

describe('prepareEmailBody', () => {
  it('passes legacy plain text through untouched', () => {
    const r = prepareEmailBody('Hi,\n\nThanks');
    expect(r).toEqual({ isHtml: false, text: 'Hi,\n\nThanks' });
  });

  it('sends rich text as html with a text fallback', () => {
    const r = prepareEmailBody('<p>Hi <strong>there</strong></p><ul><li>one</li><li>two</li></ul>');
    expect(r.isHtml).toBe(true);
    expect(r.html).toBe(
      `<div style="${EMAIL_BODY_STYLE}">` +
        `<p style="${EMAIL_BASE_STYLES.p}">Hi <strong>there</strong></p>` +
        `<ul style="${EMAIL_BASE_STYLES.ul}"><li style="${EMAIL_BASE_STYLES.li}">one</li><li style="${EMAIL_BASE_STYLES.li}">two</li></ul>` +
        '</div>',
    );
    expect(r.text).toBe('Hi there\n- one\n- two');
  });

  it('inlines base styles under the author\'s own', () => {
    const r = prepareEmailBody('<h1 style="color: #dc2626">T</h1>');
    expect(r.html).toContain(`<h1 style="${EMAIL_BASE_STYLES.h1}; color: #dc2626">T</h1>`);
  });

  it('mirrors text-align to the align attribute for Outlook', () => {
    const r = prepareEmailBody('<p style="text-align: center">x</p>');
    expect(r.html).toContain(`<p style="${EMAIL_BASE_STYLES.p}; text-align: center" align="center">x</p>`);
  });

  it('keeps font-family and font-size spans', () => {
    const r = prepareEmailBody(`<p><span style="font-family: Georgia, 'Times New Roman', serif; font-size: 18px">x</span></p>`);
    expect(r.html).toContain(`<span style="font-family: Georgia, 'Times New Roman', serif; font-size: 18px">x</span>`);
  });

  it('does not leak base styles into a raw sanitize', () => {
    expect(sanitizeEmailHtml('<p>x</p>')).toBe('<p>x</p>');
  });

  it('stringifies non-string values', () => {
    expect(prepareEmailBody(null).text).toBe('');
    expect(prepareEmailBody(42).text).toBe('42');
    expect(prepareEmailBody({ a: 1 }).text).toBe('{"a":1}');
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
});
