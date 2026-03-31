import 'mocha';
import { expect } from 'chai';
import { validateAndNormaliseLocalPath } from '~/helpers/attachmentHelpers';

function attachmentHelpersTests() {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NC_TOOL_DIR;
    process.env.NC_TOOL_DIR = '/app/data';
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NC_TOOL_DIR;
    } else {
      process.env.NC_TOOL_DIR = originalEnv;
    }
  });

  it('should accept a valid path under nc/', () => {
    const result = validateAndNormaliseLocalPath('/app/data/nc/uploads/file.txt');
    expect(result).to.contain('/app/data/nc/');
  });

  it('should reject path with nc-prefixed sibling directory (nc_minimal_dbs)', () => {
    expect(() =>
      validateAndNormaliseLocalPath('/app/data/nc_minimal_dbs/file.txt'),
    ).to.throw();
  });

  it('should reject path with nc-prefixed sibling directory (nc_other)', () => {
    expect(() =>
      validateAndNormaliseLocalPath('/app/data/nc_other/secret.txt'),
    ).to.throw();
  });

  it('should reject path traversal with ../', () => {
    expect(() =>
      validateAndNormaliseLocalPath('/app/data/nc/uploads/../../etc/passwd'),
    ).to.throw();
  });

  it('should reject path completely outside base directory', () => {
    expect(() =>
      validateAndNormaliseLocalPath('/etc/passwd'),
    ).to.throw();
  });

  it('should throw 404 when throw404 is true', () => {
    expect(() =>
      validateAndNormaliseLocalPath('/app/data/nc_minimal_dbs/file.txt', true),
    ).to.throw();
  });

  it('should accept nested paths under nc/', () => {
    const result = validateAndNormaliseLocalPath(
      '/app/data/nc/uploads/deep/nested/file.png',
    );
    expect(result).to.contain('/app/data/nc/');
  });
}

export function attachmentHelpersTest() {
  describe('attachmentHelpersTest', attachmentHelpersTests);
}
