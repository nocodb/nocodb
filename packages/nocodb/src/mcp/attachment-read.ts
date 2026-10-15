import type { NcContext } from 'nocodb-sdk';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import {
  isStorageAttachmentRef,
  resolveAttachmentFilePath,
} from '~/helpers/attachmentHelpers';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

/**
 * Storage key `readAttachment` may read for `file`, or `null` when the caller's
 * base holds no reference to it.
 */
export async function resolveReadableAttachmentPath(
  context: NcContext,
  file: { path?: string | null; url?: string | null },
  storageAdapter: IStorageAdapterV2,
): Promise<string | null> {
  if (!file.path && !file.url) return null;

  // A foreign url is not a storage key; reading its pathname as one would
  // reach arbitrary bucket objects.
  if (!file.path && !(await isStorageAttachmentRef(file.url, storageAdapter))) {
    return null;
  }

  // Only the ref actually read counts, recorded in the caller's current base.
  const fileUrlCandidates = file.path
    ? [file.path, file.path.replace(/^download[/\\]/i, '')]
    : [file.url];

  const fileRef = await Noco.ncMeta
    .knex(MetaTable.FILE_REFERENCES)
    .where({ base_id: context.base_id, deleted: false })
    .whereIn('file_url', fileUrlCandidates)
    .first();

  if (!fileRef) return null;

  // Read the reference's key: an owned `url` paired with a foreign `path` would match above.
  return resolveAttachmentFilePath(
    /^https?:\/\//i.test(fileRef.file_url)
      ? { url: fileRef.file_url }
      : { path: fileRef.file_url },
  );
}
