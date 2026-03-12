import inflection from 'inflection';

/**
 * Domains where dots in the local part are ignored by the provider.
 */
const GMAIL_DOMAINS = ['gmail.com', 'googlemail.com'];

/**
 * Normalize an email address to its canonical form to prevent alias abuse.
 *
 * - Strips plus addressing (`user+tag@` → `user@`) for all providers
 * - Removes dots from the local part for Gmail/Googlemail
 * - Normalizes `googlemail.com` → `gmail.com`
 * - Lowercases the entire address
 */
export function normalizeEmail(email: string): string {
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

  return `${localPart}@${domain}`;
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
