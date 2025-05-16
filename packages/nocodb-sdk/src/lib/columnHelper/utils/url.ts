import { isMailtoURI, isURL, IsURLOptions } from 'validator';
import { ncIsString } from '~/lib/is';

export const isValidURL = (str: string, extraProps?: IsURLOptions) => {
  // Check if the string is empty or null
  if (!str || !ncIsString(str)) return false;

  if (str.startsWith('mailto')) return isMailtoURI(str);

  let require_host = extraProps?.require_host ?? true;

  if (str.startsWith('file://') || str.startsWith('tel:')) {
    require_host = false;
  }

  // Special case for localhost URLs
  if (str.includes('localhost') || str.includes('127.0.0.1')) {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  return isURL(`${str}`, {
    ...(extraProps || {}),
    require_host,
    protocols: ['http', 'https', 'ftp', 'file', 'tel'],
  });
};
