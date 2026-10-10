import type {
  EmailAttachmentFileRef,
  EmailAttachmentSource,
  NocoDBContext,
  ResolvedEmailAttachment,
  ResolveEmailAttachmentsOptions,
} from '../nocodb';

/**
 * Per-email caps. The host enforces them (bytes overridable via
 * NC_EMAIL_ATTACHMENT_MAX_SIZE); node forms quote them in help text.
 */
export const EMAIL_MAX_ATTACHMENTS = 10;
export const EMAIL_MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

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

  const walk = (v: unknown): void => {
    if (v === null || v === undefined || v === '') return;

    if (Array.isArray(v)) {
      v.forEach(walk);
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

    switch (obj.type) {
      case 'variable':
        // Interpolation already replaced `expression` with the field's value.
        walk(obj.expression);
        return;
      case 'file':
        push({ kind: 'nocodb', file: toFileRef(obj) });
        return;
      case 'url': {
        const filename =
          typeof obj.filename === 'string' && obj.filename
            ? obj.filename
            : undefined;
        if (typeof obj.url === 'string') {
          collectString(obj.url, filename).forEach(push);
        } else {
          walk(obj.url);
        }
        return;
      }
    }

    if (isAttachmentFile(obj)) {
      push({ kind: 'nocodb', file: toFileRef(obj) });
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
