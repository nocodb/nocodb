import { isSmartText, parseProp, UITypes } from 'nocodb-sdk';
import type { Model } from '~/models';
import type { NcContext } from '~/interface/config';
import { Column, FileReference, Hook, Source } from '~/models';
import Noco from '~/Noco';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import {
  attachmentStorageRefs,
  holdAttachmentRefsInBase,
  sourcesSharingConnection,
} from '~/helpers/attachmentHelpers';
import { MetaTable } from '~/utils/globals';
import { chunkArray } from '~/utils/tsUtils';

export async function generateBaseIdMap(
  context: NcContext,
  source: Source,
  idMap: Map<string, string>,
) {
  idMap.set(source.base_id, source.base_id);
  idMap.set(source.id, `${source.base_id}::${source.id}`);
  const models = await source.getModels();

  for (const md of models) {
    idMap.set(md.id, `${source.base_id}::${source.id}::${md.id}`);
    await md.getColumns();
    for (const column of md.columns) {
      idMap.set(column.id, `${idMap.get(md.id)}::${column.id}`);
    }

    const hooks = await Hook.list(context, { fk_model_id: md.id });

    for (const hook of hooks) {
      idMap.set(hook.id, `${idMap.get(md.id)}::${hook.id}`);
    }
  }

  return models;
}

export function clearPrefix(text: string, prefix?: string) {
  if (!prefix || prefix.length === 0) return text;
  return text.replace(new RegExp(`^${prefix}_?`), '');
}

export function withoutNull(obj: any) {
  const newObj = {};
  let found = false;
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null) {
      newObj[key] = value;
      found = true;
    }
  }
  if (!found) return null;
  return newObj;
}

export function reverseGet(map: Map<string, string>, vl: string) {
  for (const [key, value] of map.entries()) {
    if (vl === value) {
      return key;
    }
  }
  return undefined;
}

export function withoutId(obj: any): any {
  const { id, ...rest } = obj;
  return rest;
}

export function getParentIdentifier(id: string) {
  const arr = id.split('::');
  arr.pop();
  return arr.join('::');
}

export function getEntityIdentifier(id: string) {
  const arr = id.split('::');
  return arr.pop();
}

export function findWithIdentifier(map: Map<string, any>, id: string) {
  for (const key of map.keys()) {
    if (getEntityIdentifier(key) === id) {
      return map.get(key);
    }
  }
  return undefined;
}

export function generateUniqueName(name: string, names: string[]) {
  // if name is unique, return it
  if (!names.includes(name)) return name;
  // if name is not unique, add a number suffix
  let newName = name;
  let i = 1;
  while (names.includes(newName)) {
    newName = `${name}_${i}`;
    i++;
  }
  return newName;
}

type DroppedAttachmentKind =
  | 'attachment'
  | 'comment file'
  | 'form image'
  | 'interface image';

// What a copy or import left out, so the job can tell whoever ran it.
export class DroppedAttachments {
  private readonly kinds = new Map<
    DroppedAttachmentKind,
    { count: number; places: Set<string> }
  >();

  add(kind: DroppedAttachmentKind, count: number, place?: string) {
    if (count <= 0) return;
    const entry = this.kinds.get(kind) ?? {
      count: 0,
      places: new Set<string>(),
    };
    entry.count += count;
    if (place) entry.places.add(place);
    this.kinds.set(kind, entry);
  }

  get count() {
    let total = 0;
    for (const { count } of this.kinds.values()) total += count;
    return total;
  }

  // e.g. "3 attachments in Orders, Customers; 1 form image"
  toString() {
    return [...this.kinds]
      .map(([kind, { count, places }]) => {
        const what = `${count} ${kind}${count === 1 ? '' : 's'}`;
        return places.size ? `${what} in ${[...places].join(', ')}` : what;
      })
      .join('; ');
  }
}

// Where copied attachments must already be held: a base, and optionally a user's own uploads.
export interface AttachmentHolder {
  baseId: string;
  sourceIds?: string[];
  userId?: string;
  // Only these source fields are checked; every field when unset.
  columnIds?: string[];
  // Every file the holder lacks is counted here.
  dropped: DroppedAttachments;
}

// Meta-source rows passed the write-time check, except in a field a conversion to Attachment hasn't cleaned yet; an external source's can be written straight into its database.
export async function sourceAttachmentHolder(
  context: NcContext,
  model: Model,
  dropped: DroppedAttachments,
): Promise<AttachmentHolder | null> {
  const source = await Source.get(context, model.source_id);
  if (!source?.isMeta()) {
    return {
      baseId: model.base_id,
      sourceIds: await sourcesSharingConnection(context, source),
      dropped,
    };
  }
  const uncleaned = (
    await Column.list(context, { fk_model_id: model.id })
  ).filter(
    (column) =>
      column.uidt === UITypes.Attachment &&
      column.internal_meta?.attachment_cleanup_pending,
  );
  return uncleaned.length
    ? {
        baseId: model.base_id,
        columnIds: uncleaned.map((column) => column.id),
        dropped,
      }
    : null;
}

// The attachments (or image refs) whose storage files the holder has a reference to.
export async function keepHeldAttachments<T>(
  attachments: T[],
  holder: AttachmentHolder,
): Promise<T[]> {
  const refs = attachments.flatMap(attachmentStorageRefs);
  if (!refs.length) return attachments;
  const held = await FileReference.listHeldFileUrls(holder, refs);
  return attachments.filter((attachment) =>
    attachmentStorageRefs(attachment).every((ref) => held.has(ref)),
  );
}

// Copied rows skip the write that holds SmartText images, so the target takes over the source table's.
export async function holdCopiedSmartTextImages(
  targetContext: NcContext,
  param: { sourceModel: Model; targetModel: Model; userId?: string },
) {
  const targetColumns = new Map(
    (await param.targetModel.getColumns()).map((column) => [
      column.column_name,
      column,
    ]),
  );
  const columnPairs = (await param.sourceModel.getColumns())
    .filter((column) => isSmartText(column))
    .map((column) => [column, targetColumns.get(column.column_name)] as const)
    .filter(([, target]) => target && isSmartText(target));
  if (!columnPairs.length) return;

  const targetSource = await Source.get(
    targetContext,
    param.targetModel.source_id,
  );
  const storage = (await NcPluginMgrv2.storageAdapter()).name;
  const liveRefs = (baseId: string, columnId: string) =>
    Noco.ncMeta
      .knexConnection(MetaTable.FILE_REFERENCES)
      .where('base_id', baseId)
      .where('fk_column_id', columnId)
      .where((qb) => qb.where('deleted', false).orWhereNull('deleted'));

  // Keyed to the target column, so a copy of this copy finds them too.
  for (const [sourceColumn, targetColumn] of columnPairs) {
    const fileUrls: string[] = await liveRefs(
      param.sourceModel.base_id,
      sourceColumn.id,
    )
      .distinct()
      .pluck('file_url');

    for (const batch of chunkArray(fileUrls, 500)) {
      const present = new Set<string>(
        await liveRefs(targetContext.base_id, targetColumn.id)
          .whereIn('file_url', batch)
          .distinct()
          .pluck('file_url'),
      );
      await FileReference.bulkInsert(
        targetContext,
        batch
          .filter((fileUrl) => !present.has(fileUrl))
          .map((fileUrl) => ({
            storage,
            file_url: fileUrl,
            file_size: 0,
            fk_user_id: param.userId ?? 'anonymous',
            source_id: targetSource?.id,
            fk_model_id: param.targetModel.id,
            fk_column_id: targetColumn.id,
            is_external: !targetSource?.isMeta(),
          })),
      );
    }
  }
}

// A trusted copy hands a form's banner and logo to the target base; an untrusted one drops those the holder lacks.
export async function copyFormImages<T extends Record<string, any>>(
  context: NcContext,
  form: T,
  param: { holder: AttachmentHolder | null; userId?: string },
): Promise<T> {
  if (!form) return form;
  const next: Record<string, any> = { ...form };
  for (const key of ['banner_image_url', 'logo_url']) {
    if (!next[key]) continue;
    const image = parseProp(next[key]);
    if (!param.holder) {
      await holdAttachmentRefsInBase(context, {
        refs: attachmentStorageRefs(image),
        userId: param.userId,
      });
    } else if (!(await keepHeldAttachments([image], param.holder)).length) {
      next[key] = null;
      param.holder.dropped.add('form image', 1);
    }
  }
  return next as T;
}

// Copied rows skip the write-time check: drops attachments the holder lacks from export JSON cells, returning the count.
export async function dropUnheldAttachments(
  rows: Record<string, unknown>[],
  attachmentColumns: string[],
  holder: AttachmentHolder,
): Promise<number> {
  const cells: { row: Record<string, unknown>; key: string; list: any[] }[] =
    [];

  for (const row of rows) {
    for (const key of attachmentColumns) {
      if (typeof row[key] !== 'string' || !row[key]) continue;
      let list: unknown;
      try {
        list = JSON.parse(row[key] as string);
      } catch {
        continue;
      }
      if (Array.isArray(list)) cells.push({ row, key, list });
    }
  }

  const refs = cells.flatMap((cell) =>
    cell.list.flatMap(attachmentStorageRefs),
  );
  if (!refs.length) return 0;
  const held = await FileReference.listHeldFileUrls(holder, refs);

  let dropped = 0;
  for (const cell of cells) {
    const kept = cell.list.filter((attachment) =>
      attachmentStorageRefs(attachment).every((ref) => held.has(ref)),
    );
    if (kept.length === cell.list.length) continue;
    dropped += cell.list.length - kept.length;
    cell.row[cell.key] = JSON.stringify(kept);
  }
  return dropped;
}
