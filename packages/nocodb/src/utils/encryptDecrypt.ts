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

  const val =
    typeof data[prop] === 'string' ? data[prop] : JSON.stringify(data[prop]);

  if (!secret) {
    return val;
  }

  return CryptoJS.AES.encrypt(val, secret).toString();
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
