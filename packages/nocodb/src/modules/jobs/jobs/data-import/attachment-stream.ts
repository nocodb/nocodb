import type { Readable } from 'stream';
import type { AttachmentReqType, FileImportType } from 'nocodb-sdk';
import type IStorageAdapterV2 from '~/types/nc-plugin/lib/IStorageAdapterV2';
import { resolveAttachmentFilePath } from '~/helpers/attachmentHelpers';
import { NcError } from '~/helpers/catchError';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';

/**
 * Opens a read stream for an uploaded import file.
 *
 * XLSX is a binary ZIP — forcing an encoding would make `fs.createReadStream`
 * emit strings, breaking unzipper. Only text formats get an encoding.
 */
export async function openImportAttachmentStream(
  importType: FileImportType,
  attachment: Pick<AttachmentReqType, 'path' | 'url'>,
  encoding?: string,
): Promise<Readable> {
  if (!attachment?.path && !attachment?.url) {
    NcError.badRequest('Attachment path or url is required');
  }

  const storage = (await NcPluginMgrv2.storageAdapter()) as IStorageAdapterV2;
  const filePath = resolveAttachmentFilePath(attachment);

  return storage.fileReadByStream(
    filePath,
    importType === 'excel' ? {} : { encoding: encoding || 'utf-8' },
  );
}

/** Best-effort temp-file cleanup for an uploaded import. */
export async function deleteImportAttachment(
  attachment: Pick<AttachmentReqType, 'path' | 'url'>,
): Promise<void> {
  if (!attachment?.path && !attachment?.url) return;
  const storage = (await NcPluginMgrv2.storageAdapter()) as IStorageAdapterV2;
  await storage.fileDelete(resolveAttachmentFilePath(attachment));
}
