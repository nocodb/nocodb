import {
  collectEmailBodyImageRefs,
  emailImageTypeForFile,
  MAX_EMAIL_INLINE_IMAGES,
  MAX_EMAIL_INLINE_IMAGES_SIZE,
} from './emailBody';
import type { EmailBodyImageFile } from './emailBody';
import type {
  EmailAttachmentFileRef,
  EmailAttachmentSource,
  NocoDBContext,
  ResolvedEmailAttachment,
  ResolveEmailAttachmentsOptions,
} from '../nocodb';

/**
 * Per-email caps. The host enforces them (bytes overridable via
 * NC_EMAIL_ATTACHMENT_MAX_SIZE); node forms quote them in help text. Bytes are
 * raw: base64 grows them by ~37%, and SMTP providers and MailerSend cap the
 * encoded message at about 25 MB.
 */
export const EMAIL_MAX_ATTACHMENTS = 10;
export const EMAIL_MAX_ATTACHMENT_BYTES = 18 * 1024 * 1024;

/**
 * Graph `sendMail` rejects requests over 4 MB, and `contentBytes` is base64 (4/3 of the raw
 * size). 2.75 MB raw leaves ~330 KB for the body, recipients and JSON envelope.
 */
export const OUTLOOK_MAX_REQUEST_BYTES = 4 * 1024 * 1024;
export const OUTLOOK_MAX_ATTACHMENT_BYTES = 2.75 * 1024 * 1024;

export function emailAttachmentsHelpText(
  maxTotalBytes = EMAIL_MAX_ATTACHMENT_BYTES,
): string {
  return `Files from attachment fields, uploaded files or URLs. Up to ${EMAIL_MAX_ATTACHMENTS} files and ${formatByteSize(
    maxTotalBytes,
  )} per email.`;
}

export const EMAIL_ATTACHMENTS_HELP_TEXT = emailAttachmentsHelpText();

const HTTP_URL_RE = /^https?:\/\/\S+$/i;

function isAttachmentFile(value: Record<string, unknown>): boolean {
  if (typeof value.path === 'string' && value.path) return true;
  if (typeof value.url !== 'string' || !value.url) return false;
  // A NocoDB attachment carries cell metadata; a bare `{ url }` is just a link.
  return 'title' in value || 'mimetype' in value || 'size' in value;
}

function toFileRef(value: Record<string, unknown>): EmailAttachmentFileRef {
  return {
    ...(typeof value.id === 'string' ? { id: value.id } : {}),
    ...(typeof value.path === 'string' ? { path: value.path } : {}),
    ...(typeof value.url === 'string' ? { url: value.url } : {}),
    ...(typeof value.title === 'string' ? { title: value.title } : {}),
    ...(typeof value.mimetype === 'string' ? { mimetype: value.mimetype } : {}),
    ...(typeof value.size === 'number' ? { size: value.size } : {}),
  };
}

// Text never becomes a stored-file reference: only `file` items and real attachment values
// (objects from an Attachment field) do, so typed JSON can't name another file.
function collectString(
  value: string,
  filename?: string,
): EmailAttachmentSource[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  // `.map(item => item.url).join(', ')` style variables arrive comma-joined. Split only
  // where the next URL starts, so a comma inside a single URL's query survives.
  const parts = trimmed
    .split(/\s*,\s*(?=https?:\/\/)/i)
    .map((p) => p.trim())
    .filter(Boolean);

  return parts.map((url) => {
    if (!HTTP_URL_RE.test(url)) {
      throw new Error(
        `Invalid attachment value "${url.slice(0, 80)}": expected an attachment field, a file or a URL`,
      );
    }
    return {
      kind: 'url',
      url,
      ...(parts.length === 1 && filename ? { filename } : {}),
    };
  });
}

/**
 * Flattens whatever interpolation left in an Attachments config into sources.
 *
 * Accepts the editor's typed items (`variable` / `file` / `url`), raw NocoDB
 * attachment arrays (a `variable` item's expression resolves to one), nested
 * arrays from list-node outputs and comma-joined URLs.
 * Duplicates (same path / url) are dropped.
 */
export function collectEmailAttachmentSources(
  value: unknown,
): EmailAttachmentSource[] {
  const out: EmailAttachmentSource[] = [];
  const seen = new Set<string>();

  const push = (source: EmailAttachmentSource) => {
    const key =
      source.kind === 'url'
        ? `url:${source.url}`
        : `file:${source.file.path ?? source.file.url}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(source);
  };

  // `urlsOnly`: inside a `url` item, where an interpolated object must not become a stored-file read.
  const walk = (v: unknown, urlsOnly = false): void => {
    if (v === null || v === undefined || v === '') return;

    if (Array.isArray(v)) {
      v.forEach((item) => walk(item, urlsOnly));
      return;
    }

    if (typeof v === 'string') {
      collectString(v).forEach(push);
      return;
    }

    if (typeof v !== 'object') {
      throw new Error(
        'Invalid attachment value: expected an attachment field, a file or a URL',
      );
    }

    const obj = v as Record<string, unknown>;

    if (urlsOnly) {
      if (typeof obj.url === 'string' && HTTP_URL_RE.test(obj.url.trim())) {
        push({ kind: 'url', url: obj.url.trim() });
        return;
      }
      throw new Error('Invalid attachment value: expected a URL');
    }

    switch (obj.type) {
      case 'variable':
        // Interpolation already replaced `expression` with the field's value.
        walk(obj.expression);
        return;
      case 'file':
        push({ kind: 'nocodb', origin: 'upload', file: toFileRef(obj) });
        return;
      case 'url': {
        const filename =
          typeof obj.filename === 'string' && obj.filename
            ? obj.filename
            : undefined;
        if (typeof obj.url === 'string') {
          collectString(obj.url, filename).forEach(push);
        } else {
          walk(obj.url, true);
        }
        return;
      }
    }

    if (isAttachmentFile(obj)) {
      push({ kind: 'nocodb', origin: 'record', file: toFileRef(obj) });
      return;
    }

    if (typeof obj.url === 'string' && HTTP_URL_RE.test(obj.url.trim())) {
      push({ kind: 'url', url: obj.url.trim() });
      return;
    }

    throw new Error(
      'Invalid attachment value: expected an attachment field, a file or a URL',
    );
  };

  walk(value);
  return out;
}

/**
 * Resolves a node's `config.attachments` to bytes via the host. Returns `[]`
 * without touching the host when nothing is configured.
 */
export async function resolveEmailAttachments(
  nocodb: Pick<NocoDBContext, 'attachmentService'>,
  value: unknown,
  options?: ResolveEmailAttachmentsOptions,
): Promise<ResolvedEmailAttachment[]> {
  const sources = collectEmailAttachmentSources(value);
  if (!sources.length) return [];

  if (!nocodb?.attachmentService) {
    throw new Error('Attachments are not supported in this environment');
  }

  return nocodb.attachmentService.resolveEmailAttachments(sources, options);
}

// Every extension SES refuses (https://docs.aws.amazon.com/ses/latest/dg/attachments.html#mime-types),
// plus other executables and web content that renders as a page.
const PLATFORM_MAILER_BLOCKED_EXTENSIONS = new Set([
  'ade', 'adp', 'apk', 'app', 'appx', 'asp', 'bas', 'bat', 'cer', 'chm', 'cmd',
  'com', 'cpl', 'crt', 'csh', 'der', 'dll', 'dmg', 'exe', 'fxp', 'gadget',
  'hlp', 'hta', 'htm', 'html', 'inf', 'ins', 'iso', 'isp', 'its', 'jar', 'js',
  'jse', 'ksh', 'lib', 'lnk', 'mad', 'maf', 'mag', 'mam', 'maq', 'mar', 'mas',
  'mat', 'mau', 'mav', 'maw', 'mda', 'mdb', 'mde', 'mdt', 'mdw', 'mdz', 'mht',
  'mhtml', 'msc', 'msh', 'msh1', 'msh1xml', 'msh2', 'msh2xml', 'mshxml', 'msi',
  'msp', 'mst', 'ops', 'pcd', 'pif', 'plg', 'prf', 'prg', 'ps1', 'ps1xml',
  'ps2', 'ps2xml', 'psc1', 'psc2', 'reg', 'scf', 'scr', 'sct', 'shb', 'shs',
  'shtml', 'svg', 'svgz', 'sys', 'tmp', 'url', 'vb', 'vbe', 'vbs', 'vps',
  'vsmacros', 'vss', 'vst', 'vsw', 'vxd', 'ws', 'wsc', 'wsf', 'wsh', 'xht',
  'xhtml', 'xnk',
]);

const PLATFORM_MAILER_BLOCKED_TYPES = new Set([
  'application/hta',
  'application/javascript',
  'application/x-msdownload',
  'application/xhtml+xml',
  'image/svg+xml',
  'text/html',
  'text/javascript',
]);

/**
 * The platform mailer sends from NocoDB's own domain, so it refuses files that
 * run or render as a page. Senders using their own account (SMTP, Gmail,
 * Outlook) are not limited.
 */
export function assertPlatformMailerAttachments(
  attachments: ResolvedEmailAttachment[],
  hint?: string,
): void {
  for (const attachment of attachments) {
    // Windows drops trailing dots and spaces, so `x.exe.` still opens as `x.exe`.
    const name = attachment.filename.replace(/[\s.\p{Cc}]+$/u, '');
    const ext = /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase();
    const type = attachment.contentType.split(';')[0].trim().toLowerCase();
    if (
      (ext && PLATFORM_MAILER_BLOCKED_EXTENSIONS.has(ext)) ||
      PLATFORM_MAILER_BLOCKED_TYPES.has(type)
    ) {
      throw new Error(
        `"${attachment.filename}" can't be sent by the built-in mailer, which blocks executables, web pages and other risky file types.${hint ? ` ${hint}` : ''}`,
      );
    }
  }
}

/**
 * Loads the stored images an email body references (`src="nc-file:…"`) via the host, which
 * applies the same base-ownership check as attachments. Returns an empty map without touching
 * the host when the body has none. Feed the result to `prepareEmailBody({ images })`.
 *
 * An image that can't be loaded (its file was removed, or it belongs to another workflow that
 * released it) is left out of the email and reported through `onSkip`, rather than failing the
 * send: the sanitizer drops an `img` without bytes.
 */
export async function resolveEmailBodyImages(
  nocodb: Pick<NocoDBContext, 'attachmentService'>,
  body: unknown,
  options: {
    onSkip?: (fileName: string, reason: string) => void;
    /** The run's cancel signal; a cancelled run stops here instead of sending without images. */
    signal?: AbortSignal;
  } = {},
): Promise<Map<string, EmailBodyImageFile>> {
  const refs = collectEmailBodyImageRefs(body).filter((ref) =>
    emailImageTypeForFile(ref),
  );
  if (!refs.length) return new Map();

  if (refs.length > MAX_EMAIL_INLINE_IMAGES) {
    throw new Error(
      `Email body has more than ${MAX_EMAIL_INLINE_IMAGES} images. Remove some images from the body.`,
    );
  }

  if (!nocodb?.attachmentService) {
    throw new Error('Images in the email body are not supported in this environment');
  }
  const service = nocodb.attachmentService;

  // One file per call, so a single missing image can't take the others down with it. The
  // body-wide size cap is enforced afterwards by extractInlineImages.
  const results = await Promise.allSettled(
    refs.map((ref) =>
      service.resolveEmailAttachments(
        [
          {
            kind: 'nocodb',
            // Body images are workflow uploads; only upload rows vouch for them.
            origin: 'upload',
            file: /^https?:\/\//i.test(ref) ? { url: ref } : { path: ref },
          },
        ],
        {
          maxFiles: 1,
          maxTotalBytes: MAX_EMAIL_INLINE_IMAGES_SIZE,
          signal: options.signal,
        },
      ),
    ),
  );

  // A cancellation rejects every pending image; it is not a skipped image, so stop the send.
  if (options.signal?.aborted) throw new Error('Execution cancelled');

  const images = new Map<string, EmailBodyImageFile>();
  results.forEach((result, i) => {
    const ref = refs[i];
    const file = result.status === 'fulfilled' ? result.value[0] : undefined;
    const contentType = emailImageTypeForFile(ref);
    if (file?.content?.length && contentType) {
      images.set(ref, { content: file.content, contentType });
      return;
    }
    const reason =
      result.status === 'rejected'
        ? String(result.reason?.message ?? result.reason)
        : 'the file is empty';
    options.onSkip?.(ref.split(/[\\/]/).pop()?.split('?')[0] || ref, reason);
  });
  return images;
}

/** nodemailer / platform-mailer attachment shape. */
export function toMailAttachments(
  attachments: ResolvedEmailAttachment[],
): Array<{ filename: string; content: Buffer; contentType: string }> {
  return attachments.map((a) => ({
    filename: a.filename,
    content: a.content,
    contentType: a.contentType,
  }));
}

/** Execution-log friendly view: never the bytes. */
export function summarizeEmailAttachments(
  attachments: ResolvedEmailAttachment[],
): Array<{ name: string; size: number; contentType: string }> {
  return attachments.map((a) => ({
    name: a.filename,
    size: a.size,
    contentType: a.contentType,
  }));
}

export function formatByteSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb < 10 ? +mb.toFixed(1) : Math.round(mb)} MB`;
  }
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
