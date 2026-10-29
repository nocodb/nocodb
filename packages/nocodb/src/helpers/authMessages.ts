// Shared by every failure case so the response does not reveal which kind of account an email has.
export const SIGNIN_FAILED_MSG =
  'Invalid credentials. If you were invited, finish signing up from your invite email. If you use Google or SSO, sign in with that option.';

export const SIGNUP_EMAIL_UNAVAILABLE_MSG =
  'Unable to sign up with this email. If you already have an account, sign in or use "Forgot password". If you were invited, use the link in your invite email. If you use Google or SSO, sign in with that option.';

export const SIGNUP_INVITE_ONLY_MSG =
  'Not allowed to signup, contact super admin. If you already have an account, sign in or use "Forgot password". If you were invited, use the link in your invite email. If you use Google or SSO, sign in with that option.';

// For an SSO/OAuth first login, which has just tried SSO.
export const SSO_SIGNUP_INVITE_ONLY_MSG =
  'Not allowed to signup, contact super admin. If you were invited, use the link in your invite email.';
