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

// Executables SES refuses outright, plus web content that renders as a page.
const PLATFORM_MAILER_BLOCKED_EXTENSIONS = new Set([
  'ade', 'adp', 'app', 'apk', 'appx', 'asp', 'bas', 'bat', 'chm', 'cmd', 'com',
  'cpl', 'dll', 'dmg', 'exe', 'gadget', 'hta', 'htm', 'html', 'inf', 'ins',
  'iso', 'isp', 'jar', 'js', 'jse', 'lnk', 'mht', 'mhtml', 'msc', 'msi', 'msp',
  'mst', 'pif', 'ps1', 'ps1xml', 'ps2', 'psc1', 'reg', 'scf', 'scr', 'sct',
  'shb', 'shs', 'shtml', 'svg', 'svgz', 'vb', 'vbe', 'vbs', 'ws', 'wsc', 'wsf',
  'wsh', 'xht', 'xhtml',
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
): void {
  for (const attachment of attachments) {
    const ext = /\.([^.]+)$/.exec(attachment.filename)?.[1]?.toLowerCase();
    const type = attachment.contentType.split(';')[0].trim().toLowerCase();
    if (
      (ext && PLATFORM_MAILER_BLOCKED_EXTENSIONS.has(ext)) ||
      PLATFORM_MAILER_BLOCKED_TYPES.has(type)
    ) {
      throw new Error(
        `"${attachment.filename}" can't be sent by the built-in mailer: executable and web page files are blocked. Send it with an SMTP, Gmail or Outlook step instead.`,
      );
    }
  }
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
