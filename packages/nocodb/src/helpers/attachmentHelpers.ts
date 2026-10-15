import path from 'path';
import fs from 'fs';
import mime from 'mime/lite';
import slash from 'slash';
import {
  IconType,
  ncIsObject,
  parseProp,
  PublicAttachmentScope,
  UITypes,
} from 'nocodb-sdk';
import { nanoid } from 'nanoid';
import moment from 'dayjs';
import hash from 'object-hash';
import type { Response } from 'express';
import type { NcContext } from 'nocodb-sdk';
import type { Column, FormulaColumn, LookupColumn } from '~/models';
import type { AttachmentsService } from '~/services/attachments.service';
import type { MetaService } from '~/meta/meta.service';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import { getToolDir } from '~/utils/nc-config';
import { NcError } from '~/helpers/catchError';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { FileReference, PresignedUrl, Source } from '~/models';
import { isSecureAttachmentEnabled, ncSiteUrl } from '~/utils';
import { isReplay } from '~/helpers/replayScope';

export const imageMimeTypes = [
  'image/aces',
  'image/apng',
  'image/avci',
  'image/avcs',
  'image/avif',
  'image/bmp',
  'image/cgm',
  'image/dicom-rle',
  'image/dpx',
  'image/emf',
  'image/example',
  'image/fits',
  'image/g3fax',
  'image/gif',
  'image/heic',
  'image/heic-sequence',
  'image/heif',
  'image/heif-sequence',
  'image/hej2k',
  'image/hsj2',
  'image/ief',
  'image/j2c',
  'image/jaii',
  'image/jais',
  'image/jls',
  'image/jp2',
  'image/jpeg',
  'image/jph',
  'image/jphc',
  'image/jpm',
  'image/jpx',
  'image/jxl',
  'image/jxr',
  'image/jxrA',
  'image/jxrS',
  'image/jxs',
  'image/jxsc',
  'image/jxsi',
  'image/jxss',
  'image/ktx',
  'image/ktx2',
  'image/naplps',
  'image/png',
  'image/prs.btif',
  'image/prs.pti',
  'image/pwg-raster',
  // 'image/svg+xml', // risk of xss
  'image/t38',
  'image/tiff',
  'image/tiff-fx',
  // All vnd.* types usually not natively supported
  // 'image/vnd.adobe.photoshop',
  // 'image/vnd.airzip.accelerator.azv',
  // 'image/vnd.blockfact.facti',
  // 'image/vnd.clip',
  // 'image/vnd.cns.inf2',
  // 'image/vnd.dece.graphic',
  // 'image/vnd.djvu',
  // 'image/vnd.dwg',
  // 'image/vnd.dxf',
  // 'image/vnd.dvb.subtitle',
  // 'image/vnd.fastbidsheet',
  // 'image/vnd.fpx',
  // 'image/vnd.fst',
  // 'image/vnd.fujixerox.edmics-mmr',
  // 'image/vnd.fujixerox.edmics-rlc',
  // 'image/vnd.globalgraphics.pgb',
  // 'image/vnd.microsoft.icon',
  // 'image/vnd.mix',
  // 'image/vnd.ms-modi',
  // 'image/vnd.mozilla.apng',
  // 'image/vnd.net-fpx',
  // 'image/vnd.pco.b16',
  // 'image/vnd.radiance',
  // 'image/vnd.sealed.png',
  // 'image/vnd.sealedmedia.softseal.gif',
  // 'image/vnd.sealedmedia.softseal.jpg',
  // 'image/vnd.svf',
  // 'image/vnd.tencent.tap',
  // 'image/vnd.valve.source.texture',
  // 'image/vnd.wap.wbmp',
  // 'image/vnd.xiff',
  // 'image/vnd.zbrush.pcx',
  'image/webp',
  'image/wmf',
  'image/x-emf',
  'image/x-wmf',
];
// Lower-cased: lookups normalize case, and a few entries (`image/jxrA`,
// `image/jxrS`) carry uppercase letters that would otherwise never match.
const previewableImageMimeTypes = new Set(
  imageMimeTypes.map((type) => type.toLowerCase()),
);

/**
 * Decide whether an attachment may be served inline (previewed) in the browser.
 *
 * Security-critical: a positive result causes the file to be served with
 * `Content-Disposition: inline` and its (client-supplied) content type, so it
 * MUST NOT accept anything the browser could render as an active document
 * (e.g. `text/html`, `image/svg+xml`, JS). We match on the exact media type —
 * NOT a substring — because the stored mimetype is attacker-controlled and a
 * substring match let a compound value such as `text/html; image/png` (or
 * `text/html;pdf`) pass while the browser parses the leading `text/html`.
 */
function isPreviewableMimeType(mimetype: unknown): boolean {
  // The stored value is client-supplied and not guaranteed to be a string (a
  // repeated query param arrives as an array), so narrow before splitting.
  if (typeof mimetype !== 'string') return false;

  // Consider only the media type, dropping any parameters (`; charset=...`).
  // Reject compound values (comma / whitespace) outright — a legitimate media
  // type never contains them, but they are how the substring bypass smuggled
  // `text/html` past this check.
  const mediaType = mimetype.split(';')[0].trim().toLowerCase();

  if (!mediaType || /[\s,]/.test(mediaType)) return false;

  const topLevel = mediaType.split('/')[0];

  if (topLevel === 'image') {
    // SVG is intentionally excluded — it can carry active script.
    return (
      mediaType !== 'image/svg+xml' && previewableImageMimeTypes.has(mediaType)
    );
  }

  if (mediaType === 'application/pdf') return true;

  return topLevel === 'video' || topLevel === 'audio';
}

export function isPreviewAllowed(args: { mimetype?: string; path?: string }) {
  const { mimetype, path } = args;

  if (mimetype) {
    return isPreviewableMimeType(mimetype);
  } else if (path) {
    const ext = path.split('.').pop();

    // clear query params
    const extWithoutQuery = ext?.split('?')[0];

    if (extWithoutQuery) {
      const mimeType = mime.getType(extWithoutQuery);
      return mimeType ? isPreviewableMimeType(mimeType) : false;
    }
  }

  return false;
}

// method for validate/normalise the path for avoid path traversal attack
export function validateAndNormaliseLocalPath(
  fileOrFolderPath: string,
  throw404 = false,
): string {
  fileOrFolderPath = slash(fileOrFolderPath);

  const toolDir = getToolDir();

  // Defense-in-depth only: every caller today reaches this via `path.join(...)`,
  // which already collapses `..` before we see it. It still guards the storage
  // adapters (`Local.ts`), which take a raw `key` straight from the caller.
  // Legitimate storage keys never contain `..`.
  if (
    fileOrFolderPath
      .replace(toolDir, '')
      .split('/')
      .some((segment) => segment === '..')
  ) {
    if (throw404) {
      NcError.notFound();
    } else {
      NcError.badRequest('Invalid path');
    }
  }

  // Get the absolute path to the base directory
  const absoluteBasePath = path.resolve(toolDir, 'nc');

  // Get the absolute path to the file
  const absolutePath = path.resolve(
    path.join(toolDir, ...fileOrFolderPath.replace(toolDir, '').split('/')),
  );

  // Check if the resolved path is within the intended directory
  // Split by separator and rejoin for equivalence to prevent prefix bypass
  // e.g. /app/data/nc_minimal_dbs would incorrectly pass startsWith('/app/data/nc')
  const baseParts = absoluteBasePath.split(path.sep);
  const targetPrefix = absolutePath
    .split(path.sep)
    .slice(0, baseParts.length)
    .join(path.sep);

  if (targetPrefix !== absoluteBasePath) {
    if (throw404) {
      NcError.notFound();
    } else {
      NcError.badRequest('Invalid path');
    }
  }

  return absolutePath;
}

export function getPathFromUrl(url: string, removePrefix = false) {
  const newUrl = new URL(encodeURI(url));

  const pathName = removePrefix
    ? newUrl.pathname.replace(/.*?nc\/uploads\//, '')
    : newUrl.pathname;

  return decodeURI(`${pathName}${newUrl.search}${newUrl.hash}`);
}

// The adapters strip a leading `<bucket>/` (path-style S3, Backblaze, GCS) or
// `<region>.digitaloceanspaces.com/<bucket>/` (Spaces), and GCS decodes `%2F`
// before resolving a key, so those forms reach our storage too.
// Every key NocoDB writes lives under `nc/` (uploads, thumbnails, app builds).
const STORAGE_KEY_RE = /^(?:[^/]+?(?:\/|%2F)){0,2}nc(?:\/|%2F)/i;

/**
 * Whether a client-supplied attachment `path`/`url` resolves to an object in
 * OUR storage — and therefore must pass an ownership check before a data write
 * accepts it — as opposed to a genuinely external http(s) file.
 *
 * Mirrors `PresignedUrl.getSignedUrl`: an http(s) url is reduced to its pathname
 * via `getPathFromUrl` and, on external storage, that pathname is signed as a
 * storage key. So a crafted `https://anything/nc/uploads/<victim>/secret.pdf`
 * would resolve to another tenant's object regardless of its host. We gate on
 * the resolved key living under `nc/`, using the SAME normalisation
 * `getSignedUrl` applies, plus the extra decode GCS (`decodeURIComponent`) and
 * R2 (`decodeURI`) run in `patchKey`, so URL-encoding can't slip past.
 * A non-http(s) value is always an opaque local storage path.
 */
export function attachmentRefResolvesToStorage(ref?: string): boolean {
  if (!ref || typeof ref !== 'string') return false;

  // a non-http(s) url/path is always an opaque storage path
  if (!/^https?:\/\//i.test(ref)) return true;

  let storageKey: string;
  try {
    storageKey = getPathFromUrl(ref).replace(/^\/+/, '');
  } catch {
    // unparseable url — fail closed and force the ownership check
    return true;
  }

  const adapterDecodes = [(key: string) => key, decodeURI, decodeURIComponent];
  return adapterDecodes.some((decode) => {
    try {
      return STORAGE_KEY_RE.test(decode(storageKey));
    } catch {
      // the adapter's decode throws too, so it never signs this key
      return false;
    }
  });
}

/** Probe key used to learn the host an adapter signs its objects on. */
const STORAGE_HOST_PROBE_KEY = 'nc/uploads/.host-probe';
const storageHostsMemo = new WeakMap<object, Promise<string[]>>();

/**
 * Hosts serving OUR objects: the active adapter's signing and public url hosts,
 * plus the NC origin (legacy urls). Memoised per adapter instance, which is
 * rebuilt on every plugin reconfiguration.
 */
async function ownStorageHosts(
  storageAdapter: IStorageAdapterV2,
): Promise<string[]> {
  const hosts: string[] = [];

  if (ncSiteUrl) {
    try {
      hosts.push(new URL(ncSiteUrl).host.toLowerCase());
    } catch {
      // malformed NC_SITE_URL: ignore
    }
  }

  if (typeof (storageAdapter as any).getSignedUrl !== 'function') {
    return hosts;
  }

  let memo = storageHostsMemo.get(storageAdapter);
  if (!memo) {
    memo = (async () => {
      const signed = await (storageAdapter as any).getSignedUrl(
        STORAGE_HOST_PROBE_KEY,
        60,
      );
      const publicUrl = storageAdapter.getUploadedPath(
        STORAGE_HOST_PROBE_KEY,
      )?.url;
      return [
        new URL(signed).host.toLowerCase(),
        ...(publicUrl ? [new URL(publicUrl).host.toLowerCase()] : []),
      ];
    })();
    storageHostsMemo.set(storageAdapter, memo);
    memo.catch(() => storageHostsMemo.delete(storageAdapter));
  }

  return [...hosts, ...(await memo)];
}

const ACTIVE_STORAGE_HOSTS_TTL_MS = 30_000;
let activeStorageHostsMemo: {
  expiresAt: number;
  hosts: Promise<string[]>;
} | null = null;

/**
 * Own hosts of the active adapter, cached process-wide for a short TTL so the
 * per-attachment sign path does not read the plugin row on every call.
 */
function activeStorageHosts(): Promise<string[]> {
  if (
    !activeStorageHostsMemo ||
    activeStorageHostsMemo.expiresAt < Date.now()
  ) {
    const hosts = NcPluginMgrv2.storageAdapter().then(ownStorageHosts);
    activeStorageHostsMemo = {
      expiresAt: Date.now() + ACTIVE_STORAGE_HOSTS_TTL_MS,
      hosts,
    };
    hosts.catch(() => {
      if (activeStorageHostsMemo?.hosts === hosts)
        activeStorageHostsMemo = null;
    });
  }
  return activeStorageHostsMemo.hosts;
}

/** Whether an http(s) url is served by our storage. Throws if the host is undeterminable. */
async function isOwnStorageUrl(
  url: string,
  storageAdapter?: IStorageAdapterV2,
): Promise<boolean> {
  const host = new URL(url).host.toLowerCase();
  const hosts = storageAdapter
    ? await ownStorageHosts(storageAdapter)
    : await activeStorageHosts();
  return hosts.includes(host);
}

/**
 * Whether an attachment `path`/`url` names an object in OUR storage, not an
 * external link. Only these are resolved to a storage key (signed, read,
 * thumbnailed, deleted). A foreign http(s) url is never a storage key, whatever
 * its pathname, and neither is one whose host cannot be determined.
 */
export async function isStorageAttachmentRef(
  ref?: string,
  storageAdapter?: IStorageAdapterV2,
): Promise<boolean> {
  if (!ref || typeof ref !== 'string') return false;

  // a non-http(s) url/path is always an opaque storage path
  if (!/^https?:\/\//i.test(ref)) return true;

  return isOwnStorageUrl(ref, storageAdapter).catch(() => false);
}

/**
 * Whether a client-supplied `path`/`url` must pass an ownership check before a
 * data write accepts it: a path, a url whose pathname resolves to a storage key,
 * or an own-host url. Fails closed: an undeterminable url is checked too.
 */
export async function needsAttachmentOwnership(
  ref?: string,
  storageAdapter?: IStorageAdapterV2,
): Promise<boolean> {
  if (!ref || typeof ref !== 'string') return false;

  if (attachmentRefResolvesToStorage(ref)) return true;

  return isOwnStorageUrl(ref, storageAdapter).catch(() => true);
}

export const attachmentStorageRefs = (attachment: any): string[] =>
  [attachment?.path, attachment?.url].filter((ref) =>
    attachmentRefResolvesToStorage(ref),
  );

// A read leaves a storage file unsigned when the row's base doesn't hold it.
export const isSignedStorageAttachment = (attachment: any): boolean =>
  attachmentStorageRefs(attachment).length > 0 &&
  !!(attachment?.signedPath || attachment?.signedUrl);

// The writer sets a cell's JSON, so a signature in it is forged until a read signs the file.
export const dropAttachmentSignatures = (value: any): void => {
  if (Array.isArray(value)) return value.forEach(dropAttachmentSignatures);
  if (value && typeof value === 'object') {
    delete value.signedPath;
    delete value.signedUrl;
    Object.values(value.thumbnails ?? {}).forEach(dropAttachmentSignatures);
  }
};

// Other fields can hold attachment-shaped JSON that no write vetted.
export async function isAttachmentField(column: Column): Promise<boolean> {
  // Reads sign a formula that only references an Attachment field, on PG only.
  if (column?.uidt === UITypes.Formula) {
    const formula = await column.getColOptions<FormulaColumn>();
    if (
      formula?.getParsedTree()?.referencedColumn?.uidt !== UITypes.Attachment
    ) {
      return false;
    }
    const source = await Source.get(column.context, column.source_id);
    return source?.type === 'pg';
  }
  let target = column;
  while (target?.uidt === UITypes.Lookup) {
    const lookup = await target.getColOptions<LookupColumn>();
    target = await lookup?.getLookupColumn();
  }
  return target?.uidt === UITypes.Attachment;
}

// External-source cells can be written straight into the database, so reads sign only held files; undefined signs all.
export async function signableAttachmentFilter(
  context: NcContext,
  param: { source?: Source; values: unknown[]; requireHeld?: boolean },
): Promise<((attachment: unknown) => boolean) | undefined> {
  // Meta-source writes passed the check; a converted field's old text didn't until its cleanup ends.
  if (param.source?.isMeta() && !param.requireHeld) return undefined;

  const refs = collectAttachmentStorageRefs(param.values);
  if (!refs.length) return undefined;

  const held = await FileReference.listHeldFileUrls(
    {
      baseId: context.base_id,
      sourceIds: await sourcesSharingConnection(context, param.source),
    },
    refs,
  );
  return (attachment) =>
    collectAttachmentStorageRefs(attachment).every((ref) => held.has(ref));
}

// One external database can be connected in several bases; a file stored through any of them is held.
export async function sourcesSharingConnection(
  context: NcContext,
  source?: Source,
): Promise<string[]> {
  if (!source?.fk_integration_id) return [];
  const sources = await Source.listByIntegration(
    context,
    source.fk_integration_id,
  );
  return sources.map((shared) => shared.id);
}

// Every storage ref a read would sign in a cell value, JSON strings and nested lists included.
export function collectAttachmentStorageRefs(value: unknown): string[] {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) return value.flatMap(collectAttachmentStorageRefs);
  return value && typeof value === 'object' ? attachmentStorageRefs(value) : [];
}

/**
 * Whether a caller may store this client-supplied attachment: an external link,
 * or a file in our storage they uploaded or this base already holds. Any write
 * that keeps a `path`/`url` from a request must pass this first, since the
 * attachment proxies later serve whatever key the stored row names.
 */
export async function isAttachmentRefOwned(
  context: NcContext,
  attachment: { path?: string; url?: string },
  userId?: string,
  ncMeta?: MetaService,
): Promise<boolean> {
  for (const ref of [attachment?.path, attachment?.url]) {
    if (!(await needsAttachmentOwnership(ref))) continue;
    if (
      !(await FileReference.isFileUrlAccessibleForWrite(
        context,
        {
          fileUrl: ref,
          userId,
        },
        ncMeta,
      ))
    ) {
      return false;
    }
  }
  return true;
}

export async function assertAttachmentRefOwned(
  context: NcContext,
  attachment: { path?: string; url?: string },
  userId?: string,
) {
  if (!(await isAttachmentRefOwned(context, attachment, userId))) {
    NcError.get(context).unprocessableEntity('Invalid attachment reference');
  }
}

// Stored images may arrive as JSON strings, which reads parse before signing.
const refsOf = (value: unknown): string[] => {
  const ref: { path?: unknown; url?: unknown } = parseProp(value);
  return ncIsObject(ref)
    ? [ref.path, ref.url].filter(
        (key): key is string => typeof key === 'string' && !!key,
      )
    : [];
};

// Clients resend an icon, logo or banner on every save, so only a ref not already stored is checked.
export async function assertNewAttachmentRefsOwned(
  context: NcContext,
  param: { value: unknown; previous?: unknown; userId?: string },
): Promise<string[]> {
  const kept = refsOf(param.previous);
  const checked: string[] = [];
  for (const ref of refsOf(param.value)) {
    if (kept.includes(ref) || !(await needsAttachmentOwnership(ref))) continue;
    // Undo and promote re-apply a write checked where it was made, maybe by another user or base.
    if (
      !isReplay() &&
      !(await FileReference.isFileUrlAccessibleForWrite(context, {
        fileUrl: ref,
        userId: param.userId,
      }))
    ) {
      NcError.get(context).unprocessableEntity('Invalid attachment reference');
    }
    checked.push(ref);
  }
  return checked;
}

// The image icon of a user, workspace or org `meta`, which reads sign.
export async function assertMetaIconOwned(
  context: NcContext,
  param: { meta: unknown; previousMeta?: unknown; userId?: string },
) {
  // Only an IMAGE icon is signed, so one kept from a non-image meta was never checked.
  const imageIcon = (meta: unknown) => {
    const parsed = parseProp(meta);
    return parsed?.iconType === IconType.IMAGE ? parsed.icon : undefined;
  };
  await assertNewAttachmentRefsOwned(context, {
    value: imageIcon(param.meta),
    previous: imageIcon(param.previousMeta),
    userId: param.userId,
  });
}

// Base-scoped refs let other base members set an image again, e.g. on undo.
export async function holdAttachmentRefsInBase(
  context: NcContext,
  param: { refs: string[]; userId?: string },
) {
  let storage: string | undefined;
  for (const fileUrl of new Set(param.refs)) {
    const inBase = await FileReference.isFileUrlAccessibleForWrite(context, {
      fileUrl,
    });
    if (inBase) continue;

    storage ??= (await NcPluginMgrv2.storageAdapter()).name;
    await FileReference.insert(context, {
      storage,
      file_url: fileUrl,
      file_size: 0,
      fk_user_id: param.userId ?? 'anonymous',
    });
  }
}

export function resolveAttachmentFilePath(attachment: {
  path?: string;
  url?: string;
}): string {
  if (attachment.path) {
    return path.join(
      'nc',
      'uploads',
      attachment.path.replace(/^download[/\\]/i, ''),
    );
  } else if (attachment.url) {
    return getPathFromUrl(attachment.url).replace(/^\/+/, '');
  }

  throw new Error('Attachment must have either path or url');
}

export const localFileExists = (path: string) => {
  return fs.promises
    .access(path)
    .then(() => true)
    .catch(() => false);
};

export const ATTACHMENT_ROOTS = [
  'thumbnails',
  PublicAttachmentScope.WORKSPACEPICS,
  PublicAttachmentScope.PROFILEPICS,
  PublicAttachmentScope.ORGANIZATIONPICS,
  PublicAttachmentScope.WHITELABEL,
  PublicAttachmentScope.MARKETPLACE,
];

export const validateNumberOfFilesInCell = async (
  _context: NcContext,
  _number: number,
  _column: Column,
) => {};

// ref: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html - extended with some more characters
// Control chars (\x00-\x1f, \x7f) are stripped too: multer >=2.3.0 decodes the
// WHATWG %0A/%0D/%22 escapes, so a CR/LF in a filename now arrives raw rather
// than percent-escaped and would otherwise land in the storage key verbatim.
export const normalizeFilename = (filename: string) => {
  // eslint-disable-next-line no-control-regex
  return filename.replace(/[\\/:*?"<>'`#|%~{}[\]^\x00-\x1f\x7f]/g, '_');
};

export const getFileNameFromUrl = (param: { url: string; scope?: string }) => {
  const originalFileName =
    param.url.split('/').pop()?.split('?')[0] || 'attachment';
  const fileName = param.scope
    ? `${normalizeFilename(path.parse(originalFileName).name)}${path.extname(
        originalFileName,
      )}`
    : `${normalizeFilename(path.parse(originalFileName).name)}_${nanoid(
        5,
      )}${path.extname(originalFileName)}`;
  return { originalFileName, fileName };
};

export interface AttachmentFilePathConstructed {
  workspaceId?: string;
  baseId: string;
  modelId: string;
  columnId: string;
  scope?: string;

  filePath: string;
  destPath: string;
  fileName: string;
  originalFileName: string;
  storageDest: string;
}

export const constructFilePath = (
  context: NcContext,
  param: {
    fileName: string;
    originalFileName: string;
    modelId: string;
    columnId: string;
    scope?: string;
  },
) => {
  let filePath = path.join(
    ...[
      // somehow, even in production gui upload doesn't use workspace id
      'noco', // context.workspace_id,
      context.base_id,
      param.modelId,
      param.columnId,
      param.scope ? nanoid(5) : undefined,
    ].filter((k) => k),
  );

  if (param.scope) {
    filePath = hash(context.user.id);
  } else if (isSecureAttachmentEnabled) {
    filePath = `${moment().format('YYYY/MM/DD')}/${hash(context.user.id)}`;
  }

  const destPath = path.join(...['nc', param.scope ?? 'uploads', filePath]);

  return {
    workspaceId: context.workspace_id,
    baseId: context.base_id,
    modelId: param.modelId,
    columnId: param.columnId,
    scope: param.scope,
    filePath,
    destPath,
    fileName: param.fileName,
    originalFileName: param.originalFileName,
    storageDest: slash(path.join(destPath, param.fileName)),
  } as AttachmentFilePathConstructed;
};

// path.join normalises ".." but doesn't prevent escape — verify explicitly.
export function sanitizeAttachmentStoragePath(joined: string): string {
  const resolved = path.resolve(joined);
  const base = path.resolve('nc', 'uploads');
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error('Invalid attachment path');
  }
  return joined;
}

export interface ServeStoredAttachmentOptions {
  // Caps how long a revoked share can still resolve the file once the
  // signed URL has left the proxy. Defaults to 5 min.
  signedUrlTtlSeconds?: number;
  cacheControl: string;
  attachmentsService: Pick<AttachmentsService, 'getFile'>;
}

// Shared between authed AttachmentProxy and anonymous PublicDocs share.
// External storage (S3/GCS/…) → 302 to signed URL; local path → stream directly.
// A local path means the file was stored on disk (attachment.path field in DB),
// so it must be served locally even when an external storage adapter is active —
// the file was never uploaded to S3.
export async function serveStoredAttachment(
  res: Response,
  fileUrl: string,
  opts: ServeStoredAttachmentOptions,
): Promise<void | Response> {
  const storageAdapter = await NcPluginMgrv2.storageAdapter();
  const isExternalStorage =
    typeof (storageAdapter as any).getSignedUrl === 'function';
  const isUrl = /^https?:\/\//i.test(fileUrl);

  if (isExternalStorage && isUrl) {
    // File is stored on external storage (identified by a full HTTP URL in the
    // attachment record) — redirect the client to a short-lived signed URL.
    const signedUrl = await PresignedUrl.getSignedUrl({
      pathOrUrl: fileUrl,
      preview: true,
      ...(opts.signedUrlTtlSeconds !== undefined && {
        expireSeconds: opts.signedUrlTtlSeconds,
      }),
    });

    res.setHeader('Cache-Control', opts.cacheControl);
    return res.redirect(302, signedUrl);
  }

  // Local file (path-based, not a URL) — stream directly from disk.
  // This also handles attachments uploaded before a migration to external
  // storage: they still have a `path` field and live on the local filesystem.
  const stripped = fileUrl.replace(/^download\//, '');

  try {
    const file = await opts.attachmentsService.getFile({
      path: sanitizeAttachmentStoragePath(path.join('nc', 'uploads', stripped)),
    });

    if (!(await localFileExists(file.path))) {
      return res.status(404).send('File not found');
    }

    res.setHeader('Cache-Control', opts.cacheControl);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (isPreviewAllowed({ mimetype: file.type, path: file.path })) {
      res.sendFile(file.path);
    } else {
      res.download(file.path);
    }
  } catch {
    res.status(404).send('Not found');
  }
}
