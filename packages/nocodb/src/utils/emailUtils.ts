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
 * Capitalizes the first letter of a string and converts the rest to lowercase.
 *
 * @param {string} str - The input string to capitalize.
 * @returns {string} The capitalized string with the first letter uppercase and the rest lowercase.
 * @example
 * capitalize('john') // Returns 'John'
 * capitalize('DOE') // Returns 'Doe'
 * capitalize('') // Returns ''
 */
const capitalize = (str: string): string => {
  if (str.length === 0) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
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
    const capitalizedParts = parts.map(capitalize);
    return capitalizedParts.join(' ');
  }
};
