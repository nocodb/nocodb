jest.mock('~/Noco', () => ({ __esModule: true, default: {} }));
const mockStorageAdapter = jest.fn();
jest.mock('~/helpers/NcPluginMgrv2', () => ({
  __esModule: true,
  default: { storageAdapter: mockStorageAdapter },
}));
jest.mock('~/utils/globals', () => ({
  MetaTable: { FILE_REFERENCES: 'nc_file_references' },
}));
jest.mock('~/helpers/attachmentHelpers', () => ({
  getPathFromUrl: (url: string, removePrefix: boolean) => {
    const pathname = new URL(url).pathname;
    return removePrefix ? pathname.replace(/.*?nc\/uploads\//, '') : pathname;
  },
}));

import Noco from '~/Noco';
import { AttachmentCleanUpProcessor } from './jobs/attachment-clean-up/attachment-clean-up';

const oldDate = () => new Date(Date.now() - 11 * 24 * 60 * 60 * 1000);

function query(result?: unknown) {
  const builder: any = {};
  builder.select = jest.fn().mockReturnValue(builder);
  builder.max = jest.fn().mockReturnValue(builder);
  builder.groupBy = jest.fn().mockReturnValue(builder);
  builder.havingRaw = jest.fn().mockReturnValue(builder);
  builder.where = jest.fn().mockReturnValue(builder);
  builder.whereNotNull = jest.fn().mockReturnValue(builder);
  builder.first = jest.fn().mockResolvedValue(result);
  builder.del = jest.fn().mockResolvedValue(1);
  return builder;
}

function setup(files: any[], rootFile?: { storage: string; file_url: string }) {
  const orphanedFiles = query();
  orphanedFiles.select
    .mockReturnValueOnce(orphanedFiles)
    .mockResolvedValueOnce(files);
  const rootKey = query(rootFile);
  const deletedRows = query();
  const knexConnection = jest
    .fn()
    .mockReturnValueOnce(orphanedFiles)
    .mockReturnValueOnce(rootKey)
    .mockReturnValueOnce(deletedRows);
  (Noco as any).ncMeta = { knexConnection };

  const fileDelete = jest.fn().mockResolvedValue(undefined);
  mockStorageAdapter.mockResolvedValue({
    name: 'R2',
    fileDelete,
  });

  return { deletedRows, fileDelete, orphanedFiles };
}

describe('AttachmentCleanUpProcessor', () => {
  it('keeps recent deleted references', async () => {
    const file = {
      file_url:
        'https://example-bucket.account-id.eu.r2.cloudflarestorage.com/nc/uploads/recent.pdf',
      last_updated_at: new Date(),
    };
    const { fileDelete, deletedRows } = setup([file], {
      storage: 'R2',
      file_url: file.file_url,
    });

    await new AttachmentCleanUpProcessor().job({ id: 'cleanup' } as any);

    expect(fileDelete).not.toHaveBeenCalled();
    expect(deletedRows.del).not.toHaveBeenCalled();
  });

  it('deletes expired orphaned objects and thumbnails', async () => {
    const file = {
      file_url:
        'https://example-bucket.account-id.eu.r2.cloudflarestorage.com/nc/uploads/expired.pdf',
      last_updated_at: oldDate(),
    };
    const { fileDelete, deletedRows } = setup([file], {
      storage: 'R2',
      file_url: file.file_url,
    });

    await new AttachmentCleanUpProcessor().job({ id: 'cleanup' } as any);

    expect(fileDelete.mock.calls).toEqual([
      ['nc/uploads/expired.pdf'],
      ['nc/thumbnails/expired.pdf/tiny.jpg'],
      ['nc/thumbnails/expired.pdf/small.jpg'],
      ['nc/thumbnails/expired.pdf/card_cover.jpg'],
    ]);
    expect(deletedRows.del).toHaveBeenCalled();
  });

  it('does not delete references that are still active', async () => {
    const { fileDelete, orphanedFiles } = setup([]);

    await new AttachmentCleanUpProcessor().job({ id: 'cleanup' } as any);

    expect(orphanedFiles.havingRaw).toHaveBeenCalledWith(
      expect.stringContaining('COUNT(CASE WHEN deleted THEN 1 END)'),
    );
    expect(fileDelete).not.toHaveBeenCalled();
  });

  it('skips files owned by another storage adapter', async () => {
    const file = {
      file_url:
        'https://example-bucket.account-id.eu.r2.cloudflarestorage.com/nc/uploads/other.pdf',
      last_updated_at: oldDate(),
    };
    const { fileDelete, deletedRows } = setup([file], {
      storage: 'S3',
      file_url: file.file_url,
    });

    await new AttachmentCleanUpProcessor().job({ id: 'cleanup' } as any);

    expect(fileDelete).not.toHaveBeenCalled();
    expect(deletedRows.del).not.toHaveBeenCalled();
  });
});
