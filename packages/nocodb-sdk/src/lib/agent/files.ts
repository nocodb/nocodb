/**
 * A file the agent reads on every run. `title` is the name its instructions
 * use and the file's name in the agent's workspace, so it is kept exactly.
 */
export interface AgentFileType {
  /** Picked by the client: instruction chips point at it before the first save. */
  id: string;
  title: string;
  mimetype: string;
  size: number;
  /** Storage key on local storage; `url` on object storage. One of the two is set. */
  path?: string;
  url?: string;
  /** Added to a copy on read, never stored. */
  signedPath?: string;
  signedUrl?: string;
}

export const AGENT_MAX_FILES = 20;

export const AGENT_MAX_FILE_SIZE = 20 * 1024 * 1024;

const AGENT_FILE_NAME_MAX_LENGTH = 200;

export const AGENT_FILE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Documents, sheets, plain text and images: what the agent can open in its workspace. */
export const AGENT_FILE_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'csv',
  'tsv',
  'txt',
  'md',
  'json',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
] as const;

/** For a file input's `accept`. */
export const AGENT_FILE_ACCEPT = AGENT_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(
  ','
);

export function isAgentFileTypeAllowed(name: string): boolean {
  const dot = name.lastIndexOf('.');
  if (dot < 1) return false;
  return (AGENT_FILE_EXTENSIONS as readonly string[]).includes(
    name.slice(dot + 1).toLowerCase()
  );
}

/** The file lands at `/home/user/<name>`, so separators, control characters and dot-only names can't stay. */
export function agentFileName(name: string): string {
  const cleaned = (name ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[/\\\u0000-\u001f\u007f]/g, '_')
    .trim();
  const safe = !cleaned || /^\.+$/.test(cleaned) ? 'file' : cleaned;
  if (safe.length <= AGENT_FILE_NAME_MAX_LENGTH) return safe;

  const dot = safe.lastIndexOf('.');
  const ext = dot > 0 && safe.length - dot <= 10 ? safe.slice(dot) : '';
  return safe.slice(0, AGENT_FILE_NAME_MAX_LENGTH - ext.length) + ext;
}

/** People read names without case, so `Report.pdf` and `report.pdf` would be one file to them. */
export function agentFileNameKey(name: string): string {
  return name.toLowerCase();
}

/** `name (2).ext` when `name.ext` is taken. */
export function uniqueAgentFileName(
  name: string,
  taken: Iterable<string>
): string {
  const keys = new Set([...taken].map(agentFileNameKey));
  if (!keys.has(agentFileNameKey(name))) return name;

  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let n = 2; ; n++) {
    const candidate = `${stem} (${n})${ext}`;
    if (!keys.has(agentFileNameKey(candidate))) return candidate;
  }
}
