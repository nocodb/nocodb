import { createHash } from 'crypto';

// Mock heavy dependencies that the service file imports but validatePKCE doesn't use
jest.mock('~/models', () => ({}));
jest.mock('~/helpers/ncError', () => ({ NcError: {} }));
jest.mock('~/Noco', () => ({}));

import { OauthTokenService } from './oauth-token.service';

describe('OauthTokenService', () => {
  let service: OauthTokenService;

  beforeEach(() => {
    service = new OauthTokenService();
  });

  describe('validatePKCE', () => {
    function makeChallenge(verifier: string): string {
      return createHash('sha256')
        .update(verifier)
        .digest('base64url');
    }

    const validVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

    it('returns true for valid S256 challenge/verifier pair', () => {
      const challenge = makeChallenge(validVerifier);
      const result = service.validatePKCE({
        codeVerifier: validVerifier,
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
      });
      expect(result).toBe(true);
    });

    it('returns false for mismatched verifier', () => {
      const challenge = makeChallenge(validVerifier);
      const result = service.validatePKCE({
        codeVerifier: 'wrong-verifier-that-is-long-enough-43-chars-xx',
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
      });
      expect(result).toBe(false);
    });

    it('returns false for non-S256 method', () => {
      const result = service.validatePKCE({
        codeVerifier: validVerifier,
        codeChallenge: 'anything',
        codeChallengeMethod: 'plain',
      });
      expect(result).toBe(false);
    });

    it('returns false when code_challenge is empty', () => {
      const result = service.validatePKCE({
        codeVerifier: validVerifier,
        codeChallenge: '',
        codeChallengeMethod: 'S256',
      });
      expect(result).toBe(false);
    });

    it('returns false when code_verifier is empty', () => {
      const challenge = makeChallenge(validVerifier);
      const result = service.validatePKCE({
        codeVerifier: '',
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
      });
      expect(result).toBe(false);
    });

    it('returns false when verifier is too short (< 43 chars)', () => {
      const shortVerifier = 'too-short';
      const challenge = makeChallenge(shortVerifier);
      const result = service.validatePKCE({
        codeVerifier: shortVerifier,
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
      });
      expect(result).toBe(false);
    });

    it('returns false when verifier is too long (> 128 chars)', () => {
      const longVerifier = 'a'.repeat(129);
      const challenge = makeChallenge(longVerifier);
      const result = service.validatePKCE({
        codeVerifier: longVerifier,
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
      });
      expect(result).toBe(false);
    });

    it('returns false when verifier contains invalid characters', () => {
      const badVerifier = 'valid-chars-but-has-space in-the-middle-pad';
      const challenge = makeChallenge(badVerifier);
      const result = service.validatePKCE({
        codeVerifier: badVerifier,
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
      });
      expect(result).toBe(false);
    });
  });
});
