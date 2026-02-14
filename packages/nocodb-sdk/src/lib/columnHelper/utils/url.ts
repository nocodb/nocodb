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

  return isURL(`${str}`, {
    ...(extraProps || {}),
    require_host,
    protocols: ['http', 'https', 'ftp', 'file', 'tel'],
  });
};

export const isValidImageURL = async (
  url: string,
  options: {
    allowDataUrl?: boolean;
    timeout?: number;
  } = {
    allowDataUrl: false,
    timeout: 5000,
  }
) => {
  if (!url || typeof url !== 'string') return false;

  const trimmed = url.trim();

  // 🚫 Always block dangerous / local schemes
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('blob:')) {
    return false;
  }

  // 🚫 Block data URLs unless explicitly allowed
  if (!options.allowDataUrl && trimmed.startsWith('data:')) {
    return false;
  }

  // If data URLs are allowed, validate image data URL explicitly
  if (options.allowDataUrl && trimmed.startsWith('data:')) {
    return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(trimmed);
  }

  // Normal URL validation
  if (
    !isURL(trimmed, {
      protocols: ['http', 'https'],
      require_protocol: true,
    })
  ) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    const img = new Image();
    const timeout = setTimeout(() => {
      img.src = '';
      resolve(false);
    }, options.timeout);

    img.onload = () => {
      clearTimeout(timeout);
      resolve(true);
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };

    img.src = trimmed;
  });
};
