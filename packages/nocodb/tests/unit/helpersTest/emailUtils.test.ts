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
