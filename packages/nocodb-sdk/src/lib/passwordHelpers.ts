export function validatePassword(p) {
  let error = '';
  const hint = null;
  let valid = true;

  if (!p) {
    error = 'At least 8 letters';
    // error = t('msg.error.signUpRules.completeRuleSet');
    valid = false;
  } else {
    if (!(p.length >= 8)) {
      error += 'At least 8 letters. ';
      // error += t('msg.error.signUpRules.atLeast8Char');
      valid = false;
    }
  }
  return { error, valid, hint };
}

/**
 * Sentinel value the backend returns in `view.password` / `dashboard.password`
 * when a password is set. The bcrypt hash never leaves the backend; the
 * frontend sees this sentinel and renders a masked state instead.
 *
 * The frontend echoes this value back on subsequent updates to signal
 * "password unchanged" — the backend strips it from the update payload
 * so the stored hash is not re-hashed.
 */
export const NC_VIEW_PASSWORD_PROTECTED_SENTINEL = '__NC_PASSWORD_MASKED__';

/**
 * Returns true when `value` looks like a bcrypt hash. Matches every bcrypt
 * variant prefix (`$2a$` / `$2b$` / `$2y$`) — bcryptjs emits `$2a$`/`$2b$`
 * today, the broader match keeps the guard correct if the hashing library
 * ever changes. Centralised so backend models (`View`, `Dashboard`) and the
 * frontend realtime handlers share one definition.
 */
export const isBcryptHash = (value: unknown): value is string => {
  return typeof value === 'string' && /^\$2[aby]\$/.test(value);
};
