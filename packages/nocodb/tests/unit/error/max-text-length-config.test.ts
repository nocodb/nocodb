import path from 'path';
import { expect } from 'chai';

const constantsModulePath = path.resolve(__dirname, '../../../src/constants');

const clearConstantsCache = () => {
  const moduleId = require.resolve(constantsModulePath);
  if (require.cache[moduleId]) {
    delete require.cache[moduleId];
  }
};

const loadMaxTextLength = () =>
  require(constantsModulePath).NC_MAX_TEXT_LENGTH as number;

export function maxTextLengthConfigTest() {
  describe('NC_MAX_TEXT_LENGTH configuration', () => {
    let originalEnv: string | undefined;

    before(() => {
      originalEnv = process.env.NC_MAX_TEXT_LENGTH;
    });

    beforeEach(() => {
      clearConstantsCache();
    });

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.NC_MAX_TEXT_LENGTH;
      } else {
        process.env.NC_MAX_TEXT_LENGTH = originalEnv;
      }
      clearConstantsCache();
    });

    after(() => {
      if (originalEnv === undefined) {
        delete process.env.NC_MAX_TEXT_LENGTH;
      } else {
        process.env.NC_MAX_TEXT_LENGTH = originalEnv;
      }
      clearConstantsCache();
    });

    it('defaults to 100000 when env not provided', () => {
      delete process.env.NC_MAX_TEXT_LENGTH;
      expect(loadMaxTextLength()).to.equal(100000);
    });

    it('uses env override when provided', () => {
      process.env.NC_MAX_TEXT_LENGTH = '200000';
      expect(loadMaxTextLength()).to.equal(200000);
    });

    it('throws for invalid env value', () => {
      process.env.NC_MAX_TEXT_LENGTH = '0';
      expect(() => loadMaxTextLength()).to.throw(
        'NC_MAX_TEXT_LENGTH must be a positive number',
      );
    });
  });
}
