export const DISPLAY_NAME_MAX_LENGTH = 60;

// Control, zero-width and bidi-override characters hide or reorder what a name shows.
const INVISIBLE_CHARS = new RegExp(
  '[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u2064\\u2066-\\u2069\\ufeff]',
  'g',
);

// Names are printed in emails we send, so they must not carry links.
const LINK =
  /[a-z][a-z0-9+.-]*:\/\/|www\.|(?:^|[^\w@-])[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|net|org|info|biz|io|co|me|app|xyz|top|site|online|shop|store|link|click|ly|gg|cc|tk|ru|cn|vip)\b/i;

const charLength = (value: string) => Array.from(value).length;

export function cleanDisplayName(name: string): string {
  return name.replace(INVISIBLE_CHARS, '').replace(/\s+/g, ' ').trim();
}

export function displayNameError(name: string): string | undefined {
  if (charLength(name) > DISPLAY_NAME_MAX_LENGTH) {
    return `Name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`;
  }
  if (LINK.test(name)) {
    return 'Name cannot contain a link';
  }
}

// An identity provider's name can't be refused: drop it if it has a link, cut it to length.
export function safeDisplayName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const cleaned = cleanDisplayName(name);
  if (!cleaned || LINK.test(cleaned)) return null;
  return Array.from(cleaned).slice(0, DISPLAY_NAME_MAX_LENGTH).join('').trim();
}
