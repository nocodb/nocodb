import 'mocha';
import { expect } from 'chai';
import { isSafeRedirectUrl } from '~/helpers/isSafeRedirectUrl';

// Regression coverage for a security improvement (control-char scheme smuggling).
export function isSafeRedirectUrlTests() {
  describe('isSafeRedirectUrl', () => {
    it('allows http(s) absolute URLs', () => {
      expect(isSafeRedirectUrl('https://example.com')).to.equal(true);
      expect(isSafeRedirectUrl('http://example.com/path?q=1#h')).to.equal(true);
      expect(isSafeRedirectUrl('HTTPS://EXAMPLE.COM')).to.equal(true);
    });

    it('allows relative (scheme-less) URLs', () => {
      expect(isSafeRedirectUrl('/dashboard')).to.equal(true);
      expect(isSafeRedirectUrl('thanks?id=1')).to.equal(true);
    });

    it('trims surrounding whitespace before validating', () => {
      expect(isSafeRedirectUrl('  https://example.com  ')).to.equal(true);
    });

    it('rejects empty / non-string input', () => {
      expect(isSafeRedirectUrl('')).to.equal(false);
      expect(isSafeRedirectUrl('   ')).to.equal(false);
      expect(isSafeRedirectUrl(undefined)).to.equal(false);
      expect(isSafeRedirectUrl(null)).to.equal(false);
      expect(isSafeRedirectUrl(123)).to.equal(false);
    });

    it('rejects javascript: and other dangerous schemes', () => {
      expect(isSafeRedirectUrl('javascript:alert(1)')).to.equal(false);
      expect(isSafeRedirectUrl('JavaScript:alert(1)')).to.equal(false);
      expect(isSafeRedirectUrl(' javascript:alert(1)')).to.equal(false);
      expect(
        isSafeRedirectUrl('data:text/html,<script>alert(1)</script>'),
      ).to.equal(false);
      expect(isSafeRedirectUrl('vbscript:msgbox(1)')).to.equal(false);
      expect(isSafeRedirectUrl('file:///etc/passwd')).to.equal(false);
      expect(isSafeRedirectUrl('mailto:a@b.com')).to.equal(false);
    });

    // The core vulnerability: control chars smuggle a dangerous scheme past a
    // naive scheme test, but the browser strips them and executes javascript:.
    // Payloads are built via fromCharCode so the source stays plain ASCII text.
    it('rejects control-char scheme smuggling (the scheme-smuggling bypass)', () => {
      const smuggle = (code: number) =>
        `java${String.fromCharCode(code)}script:alert(1)`;
      expect(isSafeRedirectUrl(smuggle(9))).to.equal(false); // tab
      expect(isSafeRedirectUrl(smuggle(10))).to.equal(false); // newline
      expect(isSafeRedirectUrl(smuggle(13))).to.equal(false); // carriage return
      expect(isSafeRedirectUrl(smuggle(0))).to.equal(false); // null
      expect(isSafeRedirectUrl(' javascript:alert(1)')).to.equal(false); // leading space
    });
  });
}
