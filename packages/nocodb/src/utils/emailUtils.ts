import inflection from 'inflection';

/**
 * Domains where dots in the local part are ignored by the provider.
 */
const GMAIL_DOMAINS = ['gmail.com', 'googlemail.com'];

// Proton treats `.`, `_` and `-` as transparent: no two accounts may differ only by them.
const PROTON_DOMAINS = [
  'proton.me',
  'protonmail.com',
  'protonmail.ch',
  'pm.me',
];

// Yahoo Inc. mail domains. Yahoo Japan (yahoo.co.jp) is a separate service with its own ID rules.
const YAHOO_DOMAIN =
  /^(?:yahoo\.(?:[a-z]{2,3}|co\.(?!jp$)[a-z]{2}|com\.[a-z]{2})|ymail\.com|rocketmail\.com|myyahoo\.com)$/;

const FASTMAIL_DOMAINS = ['fastmail.com', 'fastmail.fm'];

/**
 * Strip Unicode format chars (Cf) and default-ignorable code points — these
 * pass `validator.isEmail()` and are not stripped by `String.prototype.trim()`,
 * so they corrupt stored emails and break canonical-email dedup.
 *
 * `\p{Cf}` covers ZWSP/ZWNJ/ZWJ, bidi marks and isolates, Word Joiner, the
 * invisible-math operators (U+2061-U+2064), BOM, and the Tag block — all of
 * which pass `isEmail()` somewhere in the address.
 * `\p{Default_Ignorable_Code_Point}` adds Soft Hyphen, Variation Selectors,
 * Hangul Fillers (including the U+3164 spoofing char), Mongolian Vowel
 * Separator, and similar.
 *
 * Neither category contains any character that is legitimately part of an
 * IDN (IDNA2008 / RFC 5891) or an internationalized email local part
 * (RFC 6531), so this is safe for non-ASCII addresses.
 */
const INVISIBLE_CHARS = /[\p{Cf}\p{Default_Ignorable_Code_Point}]/gu;

/**
 * Strip invisible/formatting characters and surrounding whitespace from an
 * email-shaped input. Safe to call at any entry point — does not lowercase or
 * otherwise alter the address.
 */
export function sanitizeEmail(email: string): string {
  if (!email) return email;
  return email.replace(INVISIBLE_CHARS, '').trim();
}

/**
 * Normalize an email address to its canonical form to prevent alias abuse.
 *
 * - Strips invisible/zero-width characters and whitespace
 * - Strips plus addressing (`user+tag@` → `user@`) for all providers
 * - Removes dots from the local part for Gmail/Googlemail
 * - Normalizes `googlemail.com` → `gmail.com`
 * - Removes `.`, `_` and `-` from the local part for Proton
 * - Lowercases the entire address
 */
export function normalizeEmail(email: string): string {
  email = sanitizeEmail(email);

  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) return email.toLowerCase();

  let localPart = email.substring(0, atIndex).toLowerCase();
  let domain = email.substring(atIndex + 1).toLowerCase();

  // Strip plus addressing (user+tag → user)
  const plusIndex = localPart.indexOf('+');
  if (plusIndex !== -1) {
    localPart = localPart.substring(0, plusIndex);
  }

  // Gmail/Googlemail: dots in local part are insignificant
  if (GMAIL_DOMAINS.includes(domain)) {
    localPart = localPart.replace(/\./g, '');
    domain = 'gmail.com';
  }

  if (PROTON_DOMAINS.includes(domain)) {
    localPart = localPart.replace(/[._-]/g, '');
  }

  return `${localPart}@${domain}`;
}

// Tagged/disposable variants of another mailbox; real primaries like Gmail dots are folded by normalizeEmail instead.
export function isEmailAlias(email: string): boolean {
  if (!email) return false;

  const address = sanitizeEmail(email).toLowerCase();
  const atIndex = address.lastIndexOf('@');
  if (atIndex === -1) return false;

  const localPart = address.substring(0, atIndex);
  const domain = address.substring(atIndex + 1);

  // RFC 5233 subaddressing — every major provider delivers user+tag@ to user@.
  if (localPart.includes('+')) return true;

  // Yahoo disposable addresses are basename-keyword@; Yahoo IDs themselves cannot contain a hyphen.
  if (localPart.includes('-') && YAHOO_DOMAIN.test(domain)) return true;

  // Fastmail subdomain addressing: tag@user.fastmail.com.
  return FASTMAIL_DOMAINS.some((d) => domain.endsWith(`.${d}`));
}

export function emailAliasNotAllowedMessage(aliases: string[] = []): string {
  const message =
    'Email aliases are not allowed. Please use your primary email address';
  return aliases.length ? `${message} : ${aliases.join(', ')}` : `${message}.`;
}

// html encode string
const encode = (str: string) => {
  return str
    ?.split('')
    .map((char) => `&#${char.charCodeAt(0)};`)
    .join('');
};

// a method to sanitise content and avoid any link/url injection in email content and html encode special chars
// for example: example.com to be converted as example<span>.<span>com
export const sanitiseEmailContent = (content?: string) => {
  return content
    ?.replace(/[<>&;?#,'"$]+/g, encode)
    ?.replace(/\.|\/\/:/g, '<span>$&</span>');
};

/**
 * Extracts a display name from an email address or uses a provided display name.
 * If no display name is provided, it generates one by taking the local part of the email
 * (before '@'), splitting it by dots, capitalizing each part, and joining with spaces.
 *
 * @param {string} email - The email address to extract the display name from.
 * @param {string} [display_name] - An optional display name to use instead of generating one from the email.
 * @returns {string} The display name, either provided or generated from the email.
 * @example
 * extractDisplayNameFromEmail('john.doe@example.com', 'Johnny') // Returns 'Johnny'
 * extractDisplayNameFromEmail('jane.smith@example.com') // Returns 'Jane Smith'
 * extractDisplayNameFromEmail('alice@example.com') // Returns 'Alice'
 * extractDisplayNameFromEmail('bob..jr@example.com') // Returns 'Bob Jr'
 */
export const extractDisplayNameFromEmail = (
  email: string,
  display_name?: string,
): string => {
  if (display_name) {
    return display_name;
  } else {
    const localPart = email.split('@')[0];
    const parts = localPart.split('.').filter((part) => part.length > 0);
    const capitalizedParts = parts.map(inflection.capitalize);
    return capitalizedParts.join(' ');
  }
};
