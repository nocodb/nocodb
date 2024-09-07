import CryptoJS from 'crypto-js';
import Noco from '~/Noco';

export const encryptPropIfRequired = ({
  data,
  prop = 'config',
  secret = Noco.getConfig()?.credentialSecret,
}: {
  data: Record<string, any>;
  prop?: string;
  secret?: string;
}) => {
  if (!data || data[prop] === null || data[prop] === undefined) {
    return;
  }

  if (!secret) {
    return data[prop];
  }

  return CryptoJS.AES.encrypt(
    JSON.stringify(data[prop]),
    Noco.getConfig()?.credentialSecret,
  ).toString();
};

export const decryptPropIfRequired = ({
  data,
  prop = 'config',
  secret = Noco.getConfig()?.credentialSecret,
}: {
  data: Record<string, any>;
  prop?: string;
  secret?: string;
}) => {
  if (!data || data[prop] === null || data[prop] === undefined) {
    return;
  }

  if (!secret) {
    return data[prop];
  }

  try {
    return JSON.parse(
      CryptoJS.AES.decrypt(data[prop], secret).toString(CryptoJS.enc.Utf8),
    );
  } catch (e) {
    return data[prop];
  }
};
