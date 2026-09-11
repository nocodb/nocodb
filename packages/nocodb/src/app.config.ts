import type { AppConfig } from './interface/config';

const config: AppConfig = {
  throttler: {
    calc_execution_time: false,
  },
  basicAuth: {
    // No insecure fallback: when these env vars are unset the Basic strategy
    // fails closed rather than accepting well-known default credentials.
    username: process.env.NC_HTTP_BASIC_USER,
    password: process.env.NC_HTTP_BASIC_PASS,
  },
  auth: {
    emailPattern:
      (process.env.NC_USER_ALLOWED_EMAIL_PATTERN ||
        process.env.NC_AUTH_EMAIL_PATTERN) &&
      new RegExp(
        process.env.NC_USER_ALLOWED_EMAIL_PATTERN ||
          process.env.NC_AUTH_EMAIL_PATTERN,
      ),
    disableEmailAuth: !!process.env.NC_DISABLE_EMAIL_AUTH,
  },
  mainSubDomain: process.env.NC_MAIN_SUBDOMAIN ?? 'app',
  dashboardPath: process.env.NC_DASHBOARD_URL ?? '/',
};

export default config;
