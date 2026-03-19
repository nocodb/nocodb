import { expect } from 'chai';
import 'mocha';
import crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

export function mfaHelperTests() {
describe('MFA Helpers', () => {
  describe('Backup code generation', () => {
    function generateBackupCodes(count = 10): string[] {
      const codes: string[] = [];
      for (let i = 0; i < count; i++) {
        const code = crypto.randomBytes(4).toString('hex');
        codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
      }
      return codes;
    }

    it('should generate the requested number of codes', () => {
      const codes = generateBackupCodes(10);
      expect(codes).to.have.lengthOf(10);
    });

    it('should generate codes in xxxx-xxxx format', () => {
      const codes = generateBackupCodes(10);
      codes.forEach((code) => {
        expect(code).to.match(/^[0-9a-f]{4}-[0-9a-f]{4}$/);
      });
    });

    it('should generate unique codes', () => {
      const codes = generateBackupCodes(10);
      const unique = new Set(codes);
      expect(unique.size).to.equal(codes.length);
    });

    it('should generate different sets each time', () => {
      const set1 = generateBackupCodes(10);
      const set2 = generateBackupCodes(10);
      expect(set1).to.not.deep.equal(set2);
    });
  });

  describe('Backup code normalization', () => {
    function normalizeCode(code: string): string {
      return code.replace(/[-\s]/g, '').toLowerCase();
    }

    it('should strip dashes', () => {
      expect(normalizeCode('abcd-ef12')).to.equal('abcdef12');
    });

    it('should strip spaces', () => {
      expect(normalizeCode('abcd ef12')).to.equal('abcdef12');
    });

    it('should lowercase', () => {
      expect(normalizeCode('ABCD-EF12')).to.equal('abcdef12');
    });

    it('should handle mixed formatting', () => {
      expect(normalizeCode('Ab Cd-EF 12')).to.equal('abcdef12');
    });

    it('should match codes regardless of formatting', () => {
      const stored = 'a1b2-c3d4';
      const inputVariants = ['a1b2-c3d4', 'A1B2-C3D4', 'a1b2c3d4', 'a1b2 c3d4'];
      inputVariants.forEach((input) => {
        expect(normalizeCode(input)).to.equal(normalizeCode(stored));
      });
    });
  });

  describe('Two-factor token generation', () => {
    const testSecret = 'test-jwt-secret-for-mfa-unit-tests';

    function generateTwoFactorToken(user: {
      id: string;
      email: string;
    }): string {
      return jwt.sign(
        { id: user.id, email: user.email, purpose: 'mfa' },
        testSecret,
        { expiresIn: '5m' },
      );
    }

    it('should generate a valid JWT', () => {
      const token = generateTwoFactorToken({
        id: 'user123',
        email: 'test@example.com',
      });
      expect(token).to.be.a('string');
      expect(token.split('.')).to.have.lengthOf(3);
    });

    it('should contain correct claims', () => {
      const token = generateTwoFactorToken({
        id: 'user123',
        email: 'test@example.com',
      });
      const payload = jwt.verify(token, testSecret) as any;
      expect(payload.id).to.equal('user123');
      expect(payload.email).to.equal('test@example.com');
      expect(payload.purpose).to.equal('mfa');
    });

    it('should have 5-minute expiry', () => {
      const token = generateTwoFactorToken({
        id: 'user123',
        email: 'test@example.com',
      });
      const payload = jwt.decode(token) as any;
      const expiresIn = payload.exp - payload.iat;
      expect(expiresIn).to.equal(300); // 5 minutes
    });

    it('should reject tokens with wrong secret', () => {
      const token = generateTwoFactorToken({
        id: 'user123',
        email: 'test@example.com',
      });
      expect(() => jwt.verify(token, 'wrong-secret')).to.throw();
    });

    it('should not contain sensitive data', () => {
      const token = generateTwoFactorToken({
        id: 'user123',
        email: 'test@example.com',
      });
      const payload = jwt.decode(token) as any;
      expect(payload).to.not.have.property('password');
      expect(payload).to.not.have.property('totp_secret');
    });
  });
});
}

