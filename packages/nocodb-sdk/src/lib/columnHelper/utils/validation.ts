import { isMobilePhone } from 'validator';

export const validateEmail = (v: string) =>
  /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})$/i.test(
    v
  );

const NAMED_EMAIL_REGEX =
  /^\s*(?:"((?:[^"\\]|\\.)*)"|([^<>",;:@\\]*?))\s*<([^<>\s]+)>\s*$/;

/**
 * Parses a single `Name <address>` or `"Name" <address>` mailbox.
 * Returns null for bare addresses, line breaks, multiple mailboxes or
 * anything ambiguous.
 */
export const parseNamedEmail = (
  v: unknown
): { name: string; address: string } | null => {
  if (typeof v !== 'string' || /[\r\n]/.test(v)) return null;

  const match = v.match(NAMED_EMAIL_REGEX);
  if (!match) return null;

  const address = match[3];
  if (!validateEmail(address)) return null;

  const name =
    match[1] !== undefined ? match[1].replace(/\\(.)/g, '$1') : match[2].trim();

  return { name, address };
};

// `?`, `#`, `&`, `%` and `,` in a mailto path would start headers or extra recipients.
const encodeMailtoAddress = (address: string) =>
  address.replace(/[^A-Za-z0-9._~!$'()*+=@-]/gu, (c) => encodeURIComponent(c));

/**
 * mailto href for an Email cell value, or null when it should not be a link.
 * Named mailboxes go in a percent-encoded `to` header (RFC 6068) so the
 * display name reaches the composed recipient.
 */
export const getEmailHref = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v) return null;

  if (validateEmail(v)) return `mailto:${encodeMailtoAddress(v)}`;

  const mailbox = parseNamedEmail(v);
  if (!mailbox) return null;
  if (!mailbox.name) return `mailto:${encodeMailtoAddress(mailbox.address)}`;

  const name = /^[\p{L}\p{N}!#$%&'*+\-/=?^_`{|}~ ]+$/u.test(mailbox.name)
    ? mailbox.name
    : `"${mailbox.name.replace(/(["\\])/g, '\\$1')}"`;

  return `mailto:?to=${encodeURIComponent(`${name} <${mailbox.address}>`)}`;
};

/**
 * Phone number check shared by the server and the UI. Separators are ignored,
 * so spaced numbers like "+91 98450 12345" pass.
 */
export const isValidPhoneNumber = (v: unknown) =>
  v !== null &&
  v !== undefined &&
  isMobilePhone(String(v).replace(/[\s().-]/g, ''), 'any');
