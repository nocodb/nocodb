import { isMailtoURI, isURL, IsURLOptions } from 'validator';

export const isValidURL = (str: string, extraProps?: IsURLOptions) => {
  // Check if the string is empty or null
  if (!str) return false;

  if (str.startsWith('mailto')) return isMailtoURI(str);

  let require_host = extraProps?.require_host ?? true;

  if (str.startsWith('file://') || str.startsWith('tel:')) {
    require_host = false;
  }

  return isURL(`${str}`, {
    ...(extraProps || {}),
    require_host,
    protocols: ['http', 'https', 'ftp', 'file', 'tel'],
  });
};
