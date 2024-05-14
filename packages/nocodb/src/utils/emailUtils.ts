// html encode string
const encode = (str) => {
  const buf = [];

  for (let i = str.length - 1; i >= 0; i--) {
    const encoded = ['&#', str[i].charCodeAt(), ';'].join('');
    buf.unshift(encoded);
  }

  return buf.join('');
};

// a method to sanitise content and avoid any link/url injection in email content and html encode special chars
// for example: example.com to be converted as example<span>.<span>com
export const sanitiseEmailContent = (content: string) => {
  return content
    .replace(/[<>&;?#,'"$]+/g, encode)
    .replace(/\.|\/\/:/g, '<span>$&</span>');
};
