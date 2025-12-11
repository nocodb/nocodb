import type { AppConfig } from './interface/config';
import { isEE } from '~/utils';

const config: AppConfig = {
  throttler: {
    calc_execution_time: false,
  },
  basicAuth: {
    // Initialized by initBasicAuth() during startup
    // Sentinel values prevent use before initialization
    username: process.env.NC_HTTP_BASIC_USER ?? '__UNINITIALIZED__',
    password: process.env.NC_HTTP_BASIC_PASS ?? '__UNINITIALIZED__',
  },
  auth: {
    emailPattern:
      process.env.NC_EMAIL_PATTERN && new RegExp(process.env.NC_EMAIL_PATTERN),
    disableEmailAuth: !!process.env.NC_DISABLE_EMAIL_AUTH,
  },
  mainSubDomain: process.env.NC_MAIN_SUBDOMAIN ?? 'app',
  dashboardPath: process.env.NC_DASHBOARD_URL ?? (isEE ? '/' : '/dashboard'),
};

export default config;
