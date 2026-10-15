import type { Readable } from 'stream';
import type { AttachmentReqType, FileImportType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type IStorageAdapterV2 from '~/types/nc-plugin/lib/IStorageAdapterV2';
import {
  isStorageAttachmentRef,
  needsAttachmentOwnership,
  resolveAttachmentFilePath,
} from '~/helpers/attachmentHelpers';
import { NcError } from '~/helpers/catchError';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { FileReference } from '~/models';

export interface ImportAttachmentOwner {
  context: NcContext;
  userId?: string;
}

/**
 * Imports take `path`/`url` from the request body, and the caller's role is
 * resolved against the URL's base — not against whatever the path points at. So
 * without this an editor of any base could read (and, via the job's cleanup,
 * delete) another base's files. Same guard the data-write path applies in
 * BaseModelSqlv2.
 */
export async function assertImportAttachmentOwned(
  attachment: Pick<AttachmentReqType, 'path' | 'url'>,
  owner: ImportAttachmentOwner,
) {
  // a url without a path is read as a storage key, so a foreign url is refused
  if (!attachment.path && !(await isStorageAttachmentRef(attachment.url))) {
    NcError.get(owner.context).unprocessableEntity(
      'Invalid attachment reference',
    );
  }

  const diskResolvableRefs: string[] = [];
  for (const ref of [attachment.path, attachment.url]) {
    if (await needsAttachmentOwnership(ref)) {
      diskResolvableRefs.push(ref);
    }
  }

  for (const ref of diskResolvableRefs) {
    const accessible = await FileReference.isFileUrlAccessibleForWrite(
      owner.context,
      { fileUrl: ref, userId: owner.userId },
    );

    if (!accessible) {
      NcError.get(owner.context).unprocessableEntity(
        'Invalid attachment reference',
      );
    }
  }
}

/**
 * Opens a read stream for an uploaded import file.
 *
 * XLSX is a binary ZIP — forcing an encoding would make `fs.createReadStream`
 * emit strings, breaking unzipper. Only text formats get an encoding.
 */
export async function openImportAttachmentStream(
  importType: FileImportType,
  attachment: Pick<AttachmentReqType, 'path' | 'url'>,
  owner: ImportAttachmentOwner,
  encoding?: string,
): Promise<Readable> {
  if (!attachment?.path && !attachment?.url) {
    NcError.badRequest('Attachment path or url is required');
  }

  await assertImportAttachmentOwned(attachment, owner);

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
  owner: ImportAttachmentOwner,
): Promise<void> {
  if (!attachment?.path && !attachment?.url) return;

  await assertImportAttachmentOwned(attachment, owner);

  const storage = (await NcPluginMgrv2.storageAdapter()) as IStorageAdapterV2;
  await storage.fileDelete(resolveAttachmentFilePath(attachment));
}
