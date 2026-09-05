import { AttachmentsService } from './attachments.service';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { FileReference } from '~/models';

describe('AttachmentsService upload compensation', () => {
  it('deletes the exact destination when reference persistence fails', async () => {
    const fileDelete = jest.fn().mockResolvedValue(undefined);
    const storageAdapter = {
      name: 'R2',
      fileCreate: jest
        .fn()
        .mockResolvedValue(
          'https://example-bucket.account-id.eu.r2.cloudflarestorage.com/nc/uploads/file.txt',
        ),
      fileDelete,
    };
    const storageAdapterSpy = jest
      .spyOn(NcPluginMgrv2, 'storageAdapter')
      .mockResolvedValue(storageAdapter as any);
    const fileReferenceSpy = jest
      .spyOn(FileReference, 'insert')
      .mockRejectedValue(new Error('database unavailable'));

    const service = new AttachmentsService(
      { emit: jest.fn() } as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.upload({
        files: [
          {
            originalname: 'file.txt',
            mimetype: 'text/plain',
            size: 1,
            path: '/tmp/file.txt',
          } as any,
        ],
        req: { user: { id: 'user-id' } } as any,
      }),
    ).rejects.toBeDefined();

    expect(fileReferenceSpy).toHaveBeenCalled();
    expect(fileDelete).toHaveBeenCalledTimes(1);
    expect(fileDelete).toHaveBeenCalledWith(
      storageAdapter.fileCreate.mock.calls[0][0],
    );

    storageAdapterSpy.mockRestore();
    fileReferenceSpy.mockRestore();
  });
});
