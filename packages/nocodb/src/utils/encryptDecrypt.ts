import CryptoJS from 'crypto-js';


export const credentialEncyptSecret = process.env.NC_KEY_CREDENTIAL_ENCRYPT;

export const encryptPropIfRequired = ({
  data,
  prop = 'config',
  secret = credentialEncyptSecret,
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
    secret,
  ).toString();
};

export const decryptPropIfRequired = ({
  data,
  prop = 'config',
  secret = credentialEncyptSecret,
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
