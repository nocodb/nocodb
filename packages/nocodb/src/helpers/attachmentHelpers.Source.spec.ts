jest.mock('~/helpers/catchError', () => ({ NcError: {} }));
jest.mock('~/helpers/NcPluginMgrv2', () => ({ default: {} }));
jest.mock('~/models', () => ({ PresignedUrl: {} }));
jest.mock('~/utils', () => ({ isSecureAttachmentEnabled: jest.fn() }));
jest.mock('~/utils/nc-config', () => ({ getToolDir: jest.fn() }));
jest.mock('~/utils/ssrf', () => ({ getFilteredAgents: jest.fn() }));

import {
  getSafeAttachmentErrorLog,
  getSafeAttachmentLogIdentifier,
  tryDeleteUploadedFile,
} from './attachmentHelpers';

describe('safe attachment logging', () => {
  it('redacts URLs and credential-like values while keeping diagnostics', () => {
    const { message, stack } = getSafeAttachmentErrorLog(
      new Error(
        'upload failed https://account.example/file?X-Amz-Signature=secret token=secret',
      ),
    );

    expect(message).toContain('[REDACTED_URL]');
    expect(message).not.toContain('X-Amz-Signature=secret');
    expect(message).toContain('token=[REDACTED]');
    expect(stack).toBeDefined();
  });

  it('uses a URL pathname as a safe attachment identifier', () => {
    expect(
      getSafeAttachmentLogIdentifier(
        'https://account.example/nc/uploads/file.txt?signature=secret',
      ),
    ).toBe('/nc/uploads/file.txt');
  });
});

describe('tryDeleteUploadedFile', () => {
  it('passes the exact upload destination to the adapter', async () => {
    const fileDelete = jest.fn().mockResolvedValue(undefined);

    await tryDeleteUploadedFile({ fileDelete }, 'nc/uploads/exact/key.mp4');

    expect(fileDelete).toHaveBeenCalledWith('nc/uploads/exact/key.mp4');
  });

  it('does not replace the original failure when cleanup fails', async () => {
    const fileDelete = jest.fn().mockRejectedValue(new Error('cleanup failed'));

    await expect(
      tryDeleteUploadedFile({ fileDelete }, 'nc/uploads/exact/key.mp4'),
    ).resolves.toBeUndefined();
  });
});
