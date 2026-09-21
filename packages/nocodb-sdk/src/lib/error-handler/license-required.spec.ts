import { LicenseInactiveReason, NcErrorType } from '~/lib/globals';
import { NcErrorCodexManager } from '~/lib/error-handler/nc-error-codex-manager';

const codex = new NcErrorCodexManager();

const messageFor = (operation?: string, reason?: LicenseInactiveReason) =>
  (
    codex.generateError(NcErrorType.ERR_LICENSE_REQUIRED, {
      params: [operation || '', reason || ''],
    }) as Error
  ).message;

describe('ERR_LICENSE_REQUIRED message', () => {
  it('blames the inactive license, not the plan tier', () => {
    const message = messageFor(
      'smartTextUpdateContent',
      LicenseInactiveReason.EXPIRED
    );

    expect(message).toBe(
      'This instance does not have an active NocoDB license, so ' +
        '"smartTextUpdateContent" is unavailable. The license has expired.'
    );
    expect(message).not.toContain('Enterprise');
  });

  it('names each reason', () => {
    expect(messageFor('x', LicenseInactiveReason.NONE)).toContain(
      'No license key is configured on this instance.'
    );
    expect(messageFor('x', LicenseInactiveReason.SUSPENDED)).toContain(
      'The license has been suspended.'
    );
    expect(messageFor('x', LicenseInactiveReason.UNREACHABLE)).toContain(
      'The license server could not be reached'
    );
  });

  it('still reads as a sentence with no operation and no reason', () => {
    expect(messageFor()).toBe(
      'This instance does not have an active NocoDB license, so this operation is unavailable.'
    );
  });

  it('drops an unrecognised reason rather than trailing a blank', () => {
    expect(messageFor('x', 'wat' as LicenseInactiveReason)).toBe(
      'This instance does not have an active NocoDB license, so "x" is unavailable.'
    );
  });
});
