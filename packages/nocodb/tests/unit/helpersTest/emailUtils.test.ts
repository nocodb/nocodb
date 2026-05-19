import 'mocha';
import { expect } from 'chai';
import { normalizeEmail, sanitizeEmail } from '~/utils/emailUtils';

function emailUtilsTests() {
  describe('sanitizeEmail', () => {
    it('returns clean emails unchanged', () => {
      expect(sanitizeEmail('foo@bar.com')).to.equal('foo@bar.com');
    });

    it('returns empty string / null inputs unchanged', () => {
      expect(sanitizeEmail('')).to.equal('');
      expect(sanitizeEmail(undefined as any)).to.equal(undefined);
      expect(sanitizeEmail(null as any)).to.equal(null);
    });

    it('strips trailing zero-width space (U+200B)', () => {
      expect(sanitizeEmail('foo@bar.com​')).to.equal('foo@bar.com');
    });

    it('strips leading zero-width space', () => {
      expect(sanitizeEmail('​foo@bar.com')).to.equal('foo@bar.com');
    });

    it('strips zero-width space inside the address', () => {
      expect(sanitizeEmail('foo​@bar.com')).to.equal('foo@bar.com');
    });

    it('strips zero-width non-joiner (U+200C) and joiner (U+200D)', () => {
      expect(sanitizeEmail('foo‌‍@bar.com')).to.equal('foo@bar.com');
    });

    it('strips word joiner (U+2060) and BOM (U+FEFF)', () => {
      expect(sanitizeEmail('foo@bar.com⁠﻿')).to.equal('foo@bar.com');
    });

    it('strips bidi marks and isolates', () => {
      // LRM, RLM, LRE/RLE/PDF/LRO/RLO, LRI/RLI/FSI/PDI
      expect(sanitizeEmail('‎foo‏@bar.com‪‮⁦⁧⁨⁩')).to.equal('foo@bar.com');
    });

    it('strips soft hyphen (U+00AD)', () => {
      expect(sanitizeEmail('foo­@bar.com')).to.equal('foo@bar.com');
    });

    it('trims regular whitespace and NBSP', () => {
      expect(sanitizeEmail('  foo@bar.com  ')).to.equal('foo@bar.com');
      expect(sanitizeEmail(' foo@bar.com ')).to.equal('foo@bar.com');
    });

    it('does NOT lowercase', () => {
      expect(sanitizeEmail('Foo@Bar.COM')).to.equal('Foo@Bar.COM');
    });

    it('strips U+3164 Hangul Filler (spoofing char that passes isEmail)', () => {
      expect(sanitizeEmail('foo@bar.comㅤ')).to.equal('foo@bar.com');
    });

    it('strips U+2061-U+2064 invisible math operators', () => {
      expect(sanitizeEmail('foo@bar.com⁡⁢⁣⁤')).to.equal('foo@bar.com');
    });

    it('strips U+FE00-U+FE0F variation selectors', () => {
      expect(sanitizeEmail('foo@bar.com️︀')).to.equal('foo@bar.com');
    });

    it('strips U+180E Mongolian Vowel Separator', () => {
      expect(sanitizeEmail('foo@bar.com᠎')).to.equal('foo@bar.com');
    });

    it('strips Tag block chars (U+E0001 / U+E0020-U+E007F) from the domain', () => {
      // Tag block chars pass isEmail() in the domain part — verified locally
      expect(sanitizeEmail('foo@bar\u{E0020}\u{E0041}.com')).to.equal(
        'foo@bar.com',
      );
    });

    it('leaves IDN / internationalized addresses unchanged', () => {
      expect(sanitizeEmail('üser@bär.com')).to.equal('üser@bär.com');
      expect(sanitizeEmail('山田@example.com')).to.equal('山田@example.com');
      expect(sanitizeEmail('محمد@example.com')).to.equal('محمد@example.com');
    });
  });

  describe('normalizeEmail', () => {
    it('still strips plus-addressing and lowercases', () => {
      expect(normalizeEmail('Foo+spam@BAR.com')).to.equal('foo@bar.com');
    });

    it('still strips dots and aliases gmail/googlemail', () => {
      expect(normalizeEmail('f.o.o+x@googlemail.com')).to.equal(
        'foo@gmail.com',
      );
    });

    it('produces the same canonical for clean and ZWS-tainted emails', () => {
      const clean = 'ambassadeurs@klimaatenergiekoepel.nl';
      const tainted = 'ambassadeurs@klimaatenergiekoepel.nl​';
      expect(normalizeEmail(clean)).to.equal(normalizeEmail(tainted));
    });

    it('strips zero-width chars before splitting on @', () => {
      // ZWS right before the '@' must not split the local part incorrectly
      expect(normalizeEmail('foo​@bar.com')).to.equal('foo@bar.com');
    });

    it('handles input with no @ sign', () => {
      expect(normalizeEmail('not-an-email​')).to.equal('not-an-email');
    });
  });
}

export function emailUtilsTest() {
  describe('emailUtils', emailUtilsTests);
}
