const ignoreKeys = new Set([
  'password',
  'salt',
  'refresh_token',
  'invite_token',
  'invite_token_expires',
  'reset_password_expires',
  'reset_password_token',
  'email_verification_token',
  'created_at',
  'updated_at',
]);

// remove password and other confidential details
export function sanitiseUserObj<T>(user: T): Partial<T> {
  return Object.entries(user).reduce((obj, [key, value]) => {
    if (ignoreKeys.has(key)) return obj;

    obj[key] = value;
    return obj;
  }, {});
}
