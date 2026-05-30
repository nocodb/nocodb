import 'mocha';
import { expect } from 'chai';
import { isTokenExpired } from '~/helpers/isTokenExpired';

export function isTokenExpiredTest() {
  describe('isTokenExpired', () => {
    const past = new Date(Date.now() - 60 * 60 * 1000);
    const future = new Date(Date.now() + 60 * 60 * 1000);

    it('treats a past Date as expired', () => {
      expect(isTokenExpired(past)).to.equal(true);
    });

    it('treats a future Date as not expired', () => {
      expect(isTokenExpired(future)).to.equal(false);
    });

    it('treats a past ISO string as expired (regression: invite_token_expires varchar)', () => {
      expect(isTokenExpired(past.toISOString())).to.equal(true);
    });

    it('treats a future ISO string as not expired', () => {
      expect(isTokenExpired(future.toISOString())).to.equal(false);
    });

    it('treats a past numeric timestamp as expired', () => {
      expect(isTokenExpired(past.getTime())).to.equal(true);
    });

    it('treats a future numeric timestamp as not expired', () => {
      expect(isTokenExpired(future.getTime())).to.equal(false);
    });

    it('treats null as expired', () => {
      expect(isTokenExpired(null)).to.equal(true);
    });

    it('treats undefined as expired', () => {
      expect(isTokenExpired(undefined)).to.equal(true);
    });

    it('treats an empty string as expired', () => {
      expect(isTokenExpired('')).to.equal(true);
    });

    it('treats an unparseable date string as expired', () => {
      expect(isTokenExpired('not-a-date')).to.equal(true);
    });
  });
}
