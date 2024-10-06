import CryptoJS from 'crypto-js';

export const getCredentialEncryptSecret = () =>
  process.env.NC_KEY_CREDENTIAL_ENCRYPT;

export const isEncryptionRequired = (secret = getCredentialEncryptSecret()) => {
  return !!secret;
};
export const encryptPropIfRequired = ({
  data,
  prop = 'config',
  secret = getCredentialEncryptSecret(),
}: {
  data: Record<string, any>;
  prop?: string;
  secret?: string;
}) => {
  if (!data || data[prop] === null || data[prop] === undefined) {
    return;
  }

  if (!secret) {
    return JSON.stringify(data[prop]);
  }

  return CryptoJS.AES.encrypt(JSON.stringify(data[prop]), secret).toString();
};

export const decryptPropIfRequired = ({
  data,
  prop = 'config',
  secret = getCredentialEncryptSecret(),
}: {
  data: Record<string, any>;
  prop?: string;
  secret?: string;
}) => {
  if (!data || data[prop] === null || data[prop] === undefined) {
    return;
  }

  if (!secret) {
    return typeof data[prop] === 'string' ? JSON.parse(data[prop]) : data[prop];
  }

  try {
    return JSON.parse(
      CryptoJS.AES.decrypt(data[prop], secret).toString(CryptoJS.enc.Utf8),
    );
  } catch {
    return data[prop];
  }
};
