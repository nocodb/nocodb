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
