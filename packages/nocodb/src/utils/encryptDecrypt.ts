import CryptoJS from 'crypto-js';

export const getCredentialEncryptSecret = () =>
  process.env.NC_CONNECTION_ENCRYPT_KEY;

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

  let jsonString = data[prop];

  if (secret) {
    try {
      jsonString = CryptoJS.AES.decrypt(data[prop], secret).toString(
        CryptoJS.enc.Utf8,
      );
    } catch {
      throw new Error('Config decryption failed');
    }
  }
  return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
};
