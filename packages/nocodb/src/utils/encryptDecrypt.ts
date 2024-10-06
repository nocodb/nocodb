import CryptoJS from 'crypto-js';

export const credentialEncryptSecret = process.env.NC_KEY_CREDENTIAL_ENCRYPT;

export const isEncryptionRequired = (secret = credentialEncryptSecret) => {
  return !!secret;
};
export const encryptPropIfRequired = ({
  data,
  prop = 'config',
  secret = credentialEncryptSecret,
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
  secret = credentialEncryptSecret,
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
    CryptoJS.AES.decrypt(data[prop], secret).toString(CryptoJS.enc.Utf8);
  } catch {
    return data[prop];
  }
};
