import type { AppConfig } from './interface/config';

const config: AppConfig = {
  throttler: {
    calc_execution_time: false,
  },
  basicAuth: {
    username: process.env.NC_HTTP_BASIC_USER ?? 'defaultusername',
    password: process.env.NC_HTTP_BASIC_PASS ?? 'defaultpassword',
  },
  auth: {
    emailPattern:
      process.env.NC_EMAIL_PATTERN && new RegExp(process.env.NC_EMAIL_PATTERN),
    disableEmailAuth: !!process.env.NC_DISABLE_EMAIL_AUTH,
  },
  mainSubDomain: process.env.NC_MAIN_SUBDOMAIN ?? 'app',
  dashboardPath: process.env.NC_DASHBOARD_URL ?? '/dashboard',
};

export default config;
